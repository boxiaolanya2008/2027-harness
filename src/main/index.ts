import { app, BrowserWindow, ipcMain, dialog } from 'electron'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { join } from 'node:path'
import { getSecret, setSecret } from './security'
import { parseGitLog, parseGithubRemote, runGit, runGitStreaming } from './ipc/git'
import { incrementallyEditFileIn, readFileIn, writeFileIn, listDir, snapshotWorkspace, type FileState } from './ipc/fs'
import { runCommand } from './ipc/shell'
import { gh, ghPaginate } from './ipc/github'
import { StateRepository } from './state/repository'
import { ChangeJournal, parseWriteContext } from './state/change-journal'

const exec = promisify(execFile)

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1240,
    minHeight: 760,
    backgroundColor: '#0b0e14',
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  if (process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }
  win.setMenuBarVisibility(false)
}

function registerIpc() {
  const userDataPath = app.getPath('userData')
  const state = new StateRepository(userDataPath)
  const changes = new ChangeJournal(userDataPath)

  // Status only: secrets never cross the settings read API boundary.
  ipcMain.handle('settings:get', () => ({
    hasAiKey: !!getSecret('aiKey'),
    hasGithubToken: !!getSecret('githubToken')
  }))
  // Temporary compatibility path for existing renderer AI requests. Keep this
  // separate from settings:get and use it only immediately before a request.
  ipcMain.handle('settings:getAiKeyForRequest', () => getSecret('aiKey'))
  ipcMain.handle('settings:setAiKey', (_e, key: string) => setSecret('aiKey', key))
  ipcMain.handle('settings:setGithubToken', (_e, token: string) => setSecret('githubToken', token))
  ipcMain.handle('github:detectLocalAuth', async () => {
    const saved = getSecret('githubToken')
    try {
      if (saved) {
        const user = await gh('/user')
        return { connected: true, imported: false, login: user.login || '' }
      }
      const { stdout } = await exec('gh', ['auth', 'token'], { windowsHide: true, maxBuffer: 1024 * 1024 })
      const token = stdout.trim()
      if (!token) return { connected: false, imported: false, login: '', reason: '本机 GitHub CLI 未返回登录 token' }
      setSecret('githubToken', token)
      const user = await gh('/user')
      return { connected: true, imported: true, login: user.login || '' }
    } catch {
      return { connected: false, imported: false, login: '', reason: '未检测到 GitHub CLI 登录，请在设置中输入 Token 或执行 gh auth login' }
    }
  })

  ipcMain.handle('dialog:pickDir', async () => {
    const r = await dialog.showOpenDialog({ properties: ['openDirectory'] })
    return r.canceled ? null : r.filePaths[0]
  })

  ipcMain.handle('conversations:list', () => state.listConversations())
  ipcMain.handle('conversations:load', (_e, id: unknown) => state.loadConversation(id))
  ipcMain.handle('conversations:save', (_e, conversation: unknown) => state.saveConversation(conversation))
  ipcMain.handle('conversations:remove', (_e, id: unknown) => state.removeConversation(id))
  ipcMain.handle('projects:list', () => state.listProjects())
  ipcMain.handle('projects:upsert', (_e, project: unknown) => state.upsertProject(project))
  ipcMain.handle('projects:archive', (_e, id: unknown) => state.archiveProject(id))
  ipcMain.handle('state:load', () => state.loadUiState())
  ipcMain.handle('state:save', (_e, uiState: unknown) => state.saveUiState(uiState))

  // Read-only, allow-listed git identity. This never writes global config.
  ipcMain.handle('git:identity', async () => {
    const name = await runGit(['config', '--global', 'user.name']).catch(() => '')
    const email = await runGit(['config', '--global', 'user.email']).catch(() => '')
    return { name: name.trim(), email: email.trim() }
  })

  ipcMain.handle('git:status', (_e, cwd: string) => runGit(['status', '--porcelain'], cwd))
  ipcMain.handle('git:diff', (_e, cwd: string) => runGit(['diff'], cwd))
  ipcMain.handle('git:branch', (_e, cwd: string) => runGit(['branch', '--show-current'], cwd))
  ipcMain.handle('git:remote', (_e, cwd: string) => runGit(['remote', 'get-url', 'origin'], cwd).catch(() => ''))
  ipcMain.handle('git:timeline', async (_e, cwd: string) => {
    const isRepo = await runGit(['rev-parse', '--is-inside-work-tree'], cwd)
      .then((value) => value === 'true')
      .catch(() => false)
    if (!isRepo) return { isRepo: false, branch: '', remote: '', github: null, commits: [] }

    const [branch, remote, rawLog] = await Promise.all([
      runGit(['branch', '--show-current'], cwd).catch(() => ''),
      runGit(['remote', 'get-url', 'origin'], cwd).catch(() => ''),
      runGit(['log', '-n', '50', '--format=%H%x1f%an%x1f%ae%x1f%aI%x1f%s%x1e'], cwd).catch(() => '')
    ])
    return { isRepo: true, branch, remote, github: parseGithubRemote(remote), commits: parseGitLog(rawLog) }
  })
  ipcMain.handle('git:init', async (_e, cwd: string) => {
    await runGit(['init'], cwd)
    await runGit(['branch', '-M', 'main'], cwd)
    return true
  })
  ipcMain.handle('git:ensureRepo', async (_e, cwd: string) => {
    const isRepo = await runGit(['rev-parse', '--is-inside-work-tree'], cwd).then((value) => value === 'true').catch(() => false)
    if (!isRepo) {
      await runGit(['init'], cwd)
      await runGit(['branch', '-M', 'main'], cwd)
    }
    const branch = (await runGit(['branch', '--show-current'], cwd).catch(() => '')) || 'main'
    const remote = await runGit(['remote', 'get-url', 'origin'], cwd).catch(() => '')
    return { initialized: !isRepo, branch, remote }
  })
  ipcMain.handle('git:publish', async (_e, cwd: string, repoName: string) => {
    const name = String(repoName || '').trim()
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/.test(name)) {
      throw new Error('请输入有效的 GitHub 仓库名（仅支持字母、数字、点、下划线和短横线）')
    }
    const token = getSecret('githubToken')
    if (!token) throw new Error('未配置 GitHub token，请先到设置页面连接 GitHub')

    const isRepo = await runGit(['rev-parse', '--is-inside-work-tree'], cwd)
      .then((value) => value === 'true')
      .catch(() => false)
    if (!isRepo) {
      await runGit(['init'], cwd)
      await runGit(['branch', '-M', 'main'], cwd)
    }
    const existingRemote = await runGit(['remote', 'get-url', 'origin'], cwd).catch(() => '')
    const branch = (await runGit(['branch', '--show-current'], cwd).catch(() => '')) || 'main'
    const hasChanges = await runGit(['status', '--porcelain'], cwd).then((value) => !!value).catch(() => false)
    const hasCommit = await runGit(['rev-parse', '--verify', 'HEAD'], cwd).then(() => true).catch(() => false)
    if (hasChanges || !hasCommit) {
      await runGit(['add', '-A'], cwd)
      await runGit(['commit', '-m', hasCommit ? 'Publish current workspace' : 'Initial commit'], cwd)
    }

    let created: any = null
    if (!existingRemote) {
      // Create the remote before pushing; pushing never uses --force.
      created = await gh('/user/repos', {
        method: 'POST',
        body: JSON.stringify({ name, private: false, auto_init: false })
      })
      const remoteUrl = created?.clone_url || created?.html_url
      if (!remoteUrl) throw new Error('GitHub 未返回可用的远程地址')
      await runGit(['remote', 'add', 'origin', remoteUrl], cwd)
    }
    await runGit(['-c', `http.extraheader=AUTHORIZATION: bearer ${token}`, 'push', '-u', 'origin', branch], cwd)
    return { name: created?.name || name, full_name: created?.full_name || name, html_url: created?.html_url || existingRemote }
  })
  ipcMain.handle('git:commitAll', async (_e, cwd: string, message: string) => {
    await runGit(['add', '-A'], cwd)
    await runGit(['commit', '-m', message], cwd)
    return true
  })
  ipcMain.handle('git:newBranch', (_e, cwd: string, branch: string) =>
    runGit(['checkout', '-b', branch], cwd)
  )
  ipcMain.handle('git:push', (_e, cwd: string, branch: string) =>
    runGit(['push', '-u', 'origin', branch], cwd)
  )

  ipcMain.handle('fs:read', (_e, workspace: string, rel: string) => readFileIn(workspace, rel))
  ipcMain.handle('fs:write', async (_e, workspace: string, rel: string, content: string, context?: unknown) => {
    if (context !== undefined && parseWriteContext(context) === null) throw new Error('Invalid write context')
    const snapshot = await writeFileIn(workspace, rel, content)
    if (context !== undefined) await changes.record(context, workspace, snapshot)
    return snapshot
  })
  ipcMain.handle(
    'fs:incrementallyEdit',
    async (_e, workspace: string, rel: string, oldString: string, newString: string, replaceAll?: boolean, context?: unknown) => {
      if (context !== undefined && parseWriteContext(context) === null) throw new Error('Invalid write context')
      const snapshot = await incrementallyEditFileIn(workspace, rel, oldString, newString, replaceAll)
      if (context !== undefined) await changes.record(context, workspace, snapshot)
      return snapshot
    }
  )
  ipcMain.handle('fs:list', (_e, workspace: string, rel?: string) => listDir(workspace, rel || '.'))

  ipcMain.handle('changes:list', (_e, filter?: unknown) => changes.listChanges(filter))
  ipcMain.handle('changes:restoreFile', (_e, request: unknown) => changes.restoreFile(request))
  ipcMain.handle('changes:restoreBatch', (_e, request: unknown) => changes.restoreBatch(request))

  ipcMain.handle('shell:run', async (event, cwd: string, command: string, args: string[], context?: unknown) => {
    if (context !== undefined && parseWriteContext(context) === null) throw new Error('Invalid shell context')
    const before = context ? await snapshotWorkspace(cwd) : undefined
    let output = ''
    const result = await runCommand(cwd, command, args, (chunk) => {
      output += chunk
      event.sender.send('shell:output', chunk)
    })
    if (context && before) {
      const after = await snapshotWorkspace(cwd)
      const paths = new Set([...before.keys(), ...after.keys()])
      for (const path of paths) {
        const previous = before.get(path) || { exists: false, content: null, sha256: null, size: 0 }
        const current = after.get(path) || { exists: false, content: null, sha256: null, size: 0 }
        if (previous.sha256 === current.sha256 && previous.exists === current.exists) continue
        await changes.record(context, cwd, { path, operation: current.exists ? (previous.exists ? 'modify' : 'create') : 'delete', before: previous, after: current })
      }
    }
    return { code: result.code, output }
  })

  // GitHub REST
  ipcMain.handle('gh:get', (_e, path: string) => gh(path))
  ipcMain.handle('gh:paged', (_e, path: string) => ghPaginate(path))
  ipcMain.handle('gh:post', (_e, path: string, body?: any) =>
    gh(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined })
  )

}

app.whenReady().then(() => {
  registerIpc()
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
