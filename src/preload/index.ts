import { contextBridge, ipcRenderer } from 'electron'

const api = {
  settings: {
    get: () => ipcRenderer.invoke('settings:get'),
    setAiKey: (key: string) => ipcRenderer.invoke('settings:setAiKey', key),
    setGithubToken: (token: string) => ipcRenderer.invoke('settings:setGithubToken', token)
  },
  dialog: {
    pickDir: () => ipcRenderer.invoke('dialog:pickDir')
  },
  git: {
    config: () => ipcRenderer.invoke('git:config'),
    status: (cwd: string) => ipcRenderer.invoke('git:status', cwd),
    diff: (cwd: string) => ipcRenderer.invoke('git:diff', cwd),
    branch: (cwd: string) => ipcRenderer.invoke('git:branch', cwd),
    remote: (cwd: string) => ipcRenderer.invoke('git:remote', cwd),
    commitAll: (cwd: string, message: string) => ipcRenderer.invoke('git:commitAll', cwd, message),
    newBranch: (cwd: string, branch: string) => ipcRenderer.invoke('git:newBranch', cwd, branch),
    push: (cwd: string, branch: string) => ipcRenderer.invoke('git:push', cwd, branch)
  },
  fs: {
    read: (workspace: string, rel: string) => ipcRenderer.invoke('fs:read', workspace, rel),
    write: (workspace: string, rel: string, content: string) =>
      ipcRenderer.invoke('fs:write', workspace, rel, content),
    list: (workspace: string, rel?: string) => ipcRenderer.invoke('fs:list', workspace, rel)
  },
  shell: {
    run: (cwd: string, command: string, args: string[]) =>
      ipcRenderer.invoke('shell:run', cwd, command, args),
    onOutput: (cb: (chunk: string) => void) => {
      const listener = (_e: unknown, chunk: string) => cb(chunk)
      ipcRenderer.on('shell:output', listener)
      return () => ipcRenderer.removeListener('shell:output', listener)
    }
  },
  gh: {
    get: (path: string) => ipcRenderer.invoke('gh:get', path),
    paged: (path: string) => ipcRenderer.invoke('gh:paged', path),
    post: (path: string, body?: any) => ipcRenderer.invoke('gh:post', path, body)
  },
  indexer: {
    build: (root: string) => ipcRenderer.invoke('indexer:build', root),
    cached: (root: string) => ipcRenderer.invoke('indexer:cached', root),
    search: (root: string, query: string) => ipcRenderer.invoke('indexer:search', root, query)
  }
}

contextBridge.exposeInMainWorld('api', api)

export type SuperAgentApi = typeof api
