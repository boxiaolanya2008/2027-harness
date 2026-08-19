import { contextBridge, ipcRenderer } from 'electron'

export type JsonPrimitive = string | number | boolean | null
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue }
export type JsonObject = { [key: string]: JsonValue }

export type SerializedConversation = JsonObject & {
  id: string
  title?: string
  workspace?: string
  projectId?: string
  createdAt?: number
}

export interface ConversationSummary {
  id: string
  title: string
  workspace?: string
  projectId?: string
  createdAt?: number
  updatedAt: number
}

export interface Project {
  id: string
  name: string
  workspace: string
  createdAt: number
  updatedAt: number
  archivedAt?: number
}

export interface ProjectUpsertInput {
  id?: string
  name?: string
  workspace: string
}

export interface UiState {
  selectedWorkspace: string | null
  recentWorkspaces: string[]
  currentConversationId: string | null
  rightPanelTab: string
  repo: JsonObject | null
  selectedProjectId: string | null
  expandedProjectIds: string[]
}

export interface FileState {
  exists: boolean
  content: string | null
  sha256: string | null
  size: number
}

export interface FileChangeSnapshot {
  path: string
  operation: 'create' | 'modify'
  before: FileState
  after: FileState
}

export interface ChangeContext {
  conversationId: string
  turnId: string
  toolCallId: string
}

export interface ChangeRecord extends ChangeContext {
  id: string
  workspace: string
  path: string
  operation: 'create' | 'modify' | 'delete' | 'restore'
  before: FileState
  after: FileState
  timestamp: number
  restoreOf?: string
}

export interface AggregatedChange {
  workspace: string
  path: string
  operation: ChangeRecord['operation']
  before: FileState
  after: FileState
  latestChangeId: string
  latestTimestamp: number
  changeIds: string[]
  changeCount: number
  conversationIds: string[]
  turnIds: string[]
  toolCallIds: string[]
}

export interface ChangesListRequest {
  conversationId?: string
  turnId?: string
  toolCallId?: string
  workspace?: string
}

export interface RestoreFileRequest {
  changeId: string
  force?: boolean
}

export interface RestoreBatchRequest {
  changeIds: string[]
  force?: boolean
}

export interface RestoreResult {
  changeId: string
  restoreChangeId: string
  workspace: string
  path: string
  forced: boolean
}

const api = {
  settings: {
    get: (): Promise<{ hasAiKey: boolean; hasGithubToken: boolean }> => ipcRenderer.invoke('settings:get'),
    getAiKeyForRequest: (): Promise<string> => ipcRenderer.invoke('settings:getAiKeyForRequest'),
    setAiKey: (key: string) => ipcRenderer.invoke('settings:setAiKey', key),
    setGithubToken: (token: string) => ipcRenderer.invoke('settings:setGithubToken', token)
  },
  dialog: {
    pickDir: () => ipcRenderer.invoke('dialog:pickDir')
  },
  conversations: {
    list: (): Promise<ConversationSummary[]> => ipcRenderer.invoke('conversations:list'),
    load: (id: string): Promise<SerializedConversation | null> => ipcRenderer.invoke('conversations:load', id),
    save: (conversation: SerializedConversation): Promise<ConversationSummary> =>
      ipcRenderer.invoke('conversations:save', conversation),
    remove: (id: string): Promise<boolean> => ipcRenderer.invoke('conversations:remove', id)
  },
  projects: {
    list: (): Promise<Project[]> => ipcRenderer.invoke('projects:list'),
    upsert: (project: ProjectUpsertInput): Promise<Project> => ipcRenderer.invoke('projects:upsert', project),
    archive: (id: string): Promise<Project | null> => ipcRenderer.invoke('projects:archive', id)
  },
  state: {
    load: (): Promise<UiState> => ipcRenderer.invoke('state:load'),
    save: (state: UiState): Promise<UiState> => ipcRenderer.invoke('state:save', state)
  },
  git: {
    identity: (): Promise<{ name: string; email: string }> => ipcRenderer.invoke('git:identity'),
    status: (cwd: string) => ipcRenderer.invoke('git:status', cwd),
    diff: (cwd: string) => ipcRenderer.invoke('git:diff', cwd),
    branch: (cwd: string) => ipcRenderer.invoke('git:branch', cwd),
    remote: (cwd: string) => ipcRenderer.invoke('git:remote', cwd),
    timeline: (cwd: string) => ipcRenderer.invoke('git:timeline', cwd),
    init: (cwd: string) => ipcRenderer.invoke('git:init', cwd),
    publish: (cwd: string, repoName: string) => ipcRenderer.invoke('git:publish', cwd, repoName),
    commitAll: (cwd: string, message: string) => ipcRenderer.invoke('git:commitAll', cwd, message),
    newBranch: (cwd: string, branch: string) => ipcRenderer.invoke('git:newBranch', cwd, branch),
    push: (cwd: string, branch: string) => ipcRenderer.invoke('git:push', cwd, branch)
  },
  fs: {
    read: (workspace: string, rel: string) => ipcRenderer.invoke('fs:read', workspace, rel),
    write: (
      workspace: string,
      rel: string,
      content: string,
      context?: ChangeContext
    ): Promise<FileChangeSnapshot> => ipcRenderer.invoke('fs:write', workspace, rel, content, context),
    incrementallyEdit: (
      workspace: string,
      rel: string,
      oldString: string,
      newString: string,
      replaceAll?: boolean,
      context?: ChangeContext
    ): Promise<FileChangeSnapshot> => ipcRenderer.invoke(
      'fs:incrementallyEdit', workspace, rel, oldString, newString, replaceAll, context
    ),
    list: (workspace: string, rel?: string) => ipcRenderer.invoke('fs:list', workspace, rel)
  },
  changes: {
    list: (filter?: ChangesListRequest): Promise<AggregatedChange[]> => ipcRenderer.invoke('changes:list', filter),
    restoreFile: (request: RestoreFileRequest): Promise<RestoreResult> =>
      ipcRenderer.invoke('changes:restoreFile', request),
    restoreBatch: (request: RestoreBatchRequest): Promise<RestoreResult[]> =>
      ipcRenderer.invoke('changes:restoreBatch', request)
  },
  shell: {
    run: (cwd: string, command: string, args: string[], context?: ChangeContext) =>
      ipcRenderer.invoke('shell:run', cwd, command, args, context),
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
  }
}

contextBridge.exposeInMainWorld('api', api)

export type SuperAgentApi = typeof api
