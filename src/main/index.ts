import { app, BrowserWindow, ipcMain, dialog } from 'electron'
import { join } from 'node:path'
import { getSecret, setSecret } from './security'
import { runGit, runGitStreaming } from './ipc/git'
import { readFileIn, writeFileIn, listDir, snapshotWorkspace, type FileState } from './ipc/fs'
import { runCommand } from './ipc/shell'
import { gh, ghPaginate } from './ipc/github'
import { StateRepository } from './state/repository'
import { ChangeJournal, parseWriteContext } from './state/change-journal'

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1240,
    minHeight: 760,
    backgroundColor: '#0b0e14',
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
