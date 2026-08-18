import { app, BrowserWindow, ipcMain, dialog } from 'electron'
import { join } from 'node:path'
import { getSecret, setSecret } from './security'
import { runGit, runGitStreaming } from './ipc/git'
import { readFileIn, writeFileIn, listDir } from './ipc/fs'
import { runCommand } from './ipc/shell'
import { gh, ghPaginate } from './ipc/github'
import { buildIndex, searchIndex, loadIndex, saveIndex } from './ipc/indexer'

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1080,
    minHeight: 700,
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
  ipcMain.handle('settings:get', () => ({ aiKey: getSecret('aiKey'), githubToken: getSecret('githubToken') }))
  ipcMain.handle('settings:setAiKey', (_e, key: string) => setSecret('aiKey', key))
  ipcMain.handle('settings:setGithubToken', (_e, token: string) => setSecret('githubToken', token))

  ipcMain.handle('dialog:pickDir', async () => {
    const r = await dialog.showOpenDialog({ properties: ['openDirectory'] })
    return r.canceled ? null : r.filePaths[0]
  })

  ipcMain.handle('git:config', async () => {
    const name = await runGit(['config', '--global', 'user.name']).catch(() => '')
    const email = await runGit(['config', '--global', 'user.email']).catch(() => '')
    return { name, email }
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
  ipcMain.handle('fs:write', (_e, workspace: string, rel: string, content: string) =>
    writeFileIn(workspace, rel, content)
  )
  ipcMain.handle('fs:list', (_e, workspace: string, rel?: string) => listDir(workspace, rel || '.'))

  ipcMain.handle('shell:run', async (event, cwd: string, command: string, args: string[]) => {
    let output = ''
    const result = await runCommand(cwd, command, args, (chunk) => {
      output += chunk
      event.sender.send('shell:output', chunk)
    })
    return { code: result.code, output }
  })

  // GitHub REST
  ipcMain.handle('gh:get', (_e, path: string) => gh(path))
  ipcMain.handle('gh:paged', (_e, path: string) => ghPaginate(path))
  ipcMain.handle('gh:post', (_e, path: string, body?: any) =>
    gh(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined })
  )

  // RAG
  ipcMain.handle('indexer:build', (_e, root: string) => {
    const idx = buildIndex(root)
    saveIndex(idx)
    return { files: idx.files.length, chunks: idx.chunks.length }
  })
  ipcMain.handle('indexer:cached', (_e, root: string) => !!loadIndex(root))
  ipcMain.handle('indexer:search', (_e, root: string, query: string) => {
    const idx = loadIndex(root)
    if (!idx) return []
    return searchIndex(idx, query)
  })
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
