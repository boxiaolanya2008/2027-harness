import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { basename, dirname, join, resolve } from 'node:path'

// Keep the existing v1 format for conversations and UI state. Projects have their
// own index format so adding grouping never invalidates already persisted state.
const STORAGE_VERSION = 1
const PROJECTS_VERSION = 1
const MAX_JSON_BYTES = 10 * 1024 * 1024
const MAX_WORKSPACES = 50
const CONVERSATION_ID = /^[A-Za-z0-9_-]{1,128}$/

type JsonPrimitive = string | number | boolean | null
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

interface ConversationIndexFile {
  version: typeof STORAGE_VERSION
  conversations: ConversationSummary[]
}

interface ConversationFile {
  version: typeof STORAGE_VERSION
  conversation: SerializedConversation
}

interface ProjectsIndexFile {
  version: typeof PROJECTS_VERSION
  projects: Project[]
}

interface UiStateFile {
  version: typeof STORAGE_VERSION
  state: UiState
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isJsonValue(value: unknown, depth = 0): value is JsonValue {
  if (depth > 50) return false
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true
  if (typeof value === 'number') return Number.isFinite(value)
  if (Array.isArray(value)) return value.every((item) => isJsonValue(item, depth + 1))
  if (!isObject(value)) return false
  return Object.values(value).every((item) => isJsonValue(item, depth + 1))
}

function isConversationId(value: unknown): value is string {
  return typeof value === 'string' && CONVERSATION_ID.test(value)
}

function isFiniteTimestamp(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
}

function canonicalWorkspace(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null
  return resolve(value.trim())
}

function workspaceKey(workspace: string) {
  return process.platform === 'win32' ? workspace.toLowerCase() : workspace
}

function projectName(workspace: string) {
  return basename(workspace) || workspace
}

function parseConversation(value: unknown): SerializedConversation | null {
  if (!isObject(value) || !isConversationId(value.id) || !isJsonValue(value)) return null
  if (value.title !== undefined && typeof value.title !== 'string') return null
  if (value.workspace !== undefined && typeof value.workspace !== 'string') return null
  if (value.projectId !== undefined && !isConversationId(value.projectId)) return null
  if (value.createdAt !== undefined && !isFiniteTimestamp(value.createdAt)) return null
  return value as SerializedConversation
}

function parseSummary(value: unknown): ConversationSummary | null {
  if (!isObject(value) || !isConversationId(value.id) || typeof value.title !== 'string') return null
  if (value.workspace !== undefined && typeof value.workspace !== 'string') return null
  if (value.projectId !== undefined && !isConversationId(value.projectId)) return null
  if (value.createdAt !== undefined && !isFiniteTimestamp(value.createdAt)) return null
  if (!isFiniteTimestamp(value.updatedAt)) return null

  return {
    id: value.id,
    title: value.title,
    ...(typeof value.workspace === 'string' ? { workspace: value.workspace } : {}),
    ...(typeof value.projectId === 'string' ? { projectId: value.projectId } : {}),
    ...(typeof value.createdAt === 'number' ? { createdAt: value.createdAt } : {}),
    updatedAt: value.updatedAt
  }
}

function parseProject(value: unknown): Project | null {
  if (!isObject(value) || !isConversationId(value.id) || typeof value.name !== 'string') return null
  const workspace = canonicalWorkspace(value.workspace)
  if (!workspace || !isFiniteTimestamp(value.createdAt) || !isFiniteTimestamp(value.updatedAt)) return null
  if (value.archivedAt !== undefined && !isFiniteTimestamp(value.archivedAt)) return null
  return {
    id: value.id,
    name: value.name || projectName(workspace),
    workspace,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
    ...(typeof value.archivedAt === 'number' ? { archivedAt: value.archivedAt } : {})
  }
}

function parseProjectUpsert(value: unknown): ProjectUpsertInput | null {
  if (!isObject(value)) return null
  const workspace = canonicalWorkspace(value.workspace)
  if (!workspace) return null
  if (value.id !== undefined && !isConversationId(value.id)) return null
  if (value.name !== undefined && (typeof value.name !== 'string' || !value.name.trim())) return null
  return {
    workspace,
    ...(typeof value.id === 'string' ? { id: value.id } : {}),
    ...(typeof value.name === 'string' ? { name: value.name.trim() } : {})
  }
}

function defaultUiState(): UiState {
  return {
    selectedWorkspace: null,
    recentWorkspaces: [],
    currentConversationId: null,
    rightPanelTab: 'github',
    repo: null,
    selectedProjectId: null,
    expandedProjectIds: []
  }
}

function parseUiState(value: unknown): UiState | null {
  if (!isObject(value)) return null
  const selectedWorkspace = value.selectedWorkspace
  const recentWorkspaces = value.recentWorkspaces
  const currentConversationId = value.currentConversationId
  const rightPanelTab = value.rightPanelTab
  const repo = value.repo
  const selectedProjectId = value.selectedProjectId
  const expandedProjectIds = value.expandedProjectIds

  if (selectedWorkspace !== null && typeof selectedWorkspace !== 'string') return null
  if (!Array.isArray(recentWorkspaces) || recentWorkspaces.length > MAX_WORKSPACES) return null
  if (!recentWorkspaces.every((workspace) => typeof workspace === 'string')) return null
  if (currentConversationId !== undefined && currentConversationId !== null && !isConversationId(currentConversationId)) return null
  if (typeof rightPanelTab !== 'string') return null
  if (repo !== null && (!isObject(repo) || !isJsonValue(repo))) return null
  if (selectedProjectId !== undefined && selectedProjectId !== null && !isConversationId(selectedProjectId)) return null
  if (expandedProjectIds !== undefined && (!Array.isArray(expandedProjectIds) || !expandedProjectIds.every(isConversationId))) return null

  return {
    selectedWorkspace,
    recentWorkspaces: [...recentWorkspaces],
    currentConversationId: typeof currentConversationId === 'string' ? currentConversationId : null,
    rightPanelTab,
    repo: repo === null ? null : (repo as JsonObject),
    selectedProjectId: typeof selectedProjectId === 'string' ? selectedProjectId : null,
    expandedProjectIds: Array.isArray(expandedProjectIds) ? [...expandedProjectIds] : []
  }
}

async function readJson(filePath: string): Promise<unknown | null> {
  try {
    return JSON.parse(await readFile(filePath, 'utf-8'))
  } catch {
    return null
  }
}

async function writeJsonAtomic(filePath: string, value: unknown) {
  const json = JSON.stringify(value)
  if (!json || Buffer.byteLength(json, 'utf-8') > MAX_JSON_BYTES) {
    throw new Error('State payload is too large to persist')
  }

  await mkdir(dirname(filePath), { recursive: true })
  const tempPath = `${filePath}.${process.pid}.${randomUUID()}.tmp`
  try {
    await writeFile(tempPath, json, { encoding: 'utf-8', flag: 'wx' })
    await rename(tempPath, filePath)
  } finally {
    await rm(tempPath, { force: true }).catch(() => undefined)
  }
}

export class StateRepository {
  private readonly conversationsDir: string
  private readonly indexPath: string
  private readonly projectsPath: string
  private readonly uiStatePath: string
  private writes = Promise.resolve()
  private projectMigration: Promise<void> | null = null

  constructor(userDataPath: string) {
    const root = join(userDataPath, 'state')
    this.conversationsDir = join(root, 'conversations')
    this.indexPath = join(this.conversationsDir, 'index.json')
    this.projectsPath = join(root, 'projects', 'index.json')
    this.uiStatePath = join(root, 'ui-state.json')
  }

  async listConversations(): Promise<ConversationSummary[]> {
    await this.ensureProjectMigration()
    return (await this.readConversationIndex()).conversations
  }

  async loadConversation(id: unknown): Promise<SerializedConversation | null> {
    if (!isConversationId(id)) return null
    await this.ensureProjectMigration()
    const data = await readJson(this.conversationPath(id))
    if (!isObject(data) || data.version !== STORAGE_VERSION) return null
    return parseConversation(data.conversation)
  }

  saveConversation(conversation: unknown): Promise<ConversationSummary> {
    const parsed = parseConversation(conversation)
    if (!parsed) return Promise.reject(new Error('Invalid conversation payload'))

    return this.ensureProjectMigration().then(() => this.queueWrite(async () => {
      const now = Date.now()
      const summary: ConversationSummary = {
        id: parsed.id,
        title: parsed.title || 'Untitled conversation',
        ...(parsed.workspace ? { workspace: parsed.workspace } : {}),
        ...(parsed.projectId ? { projectId: parsed.projectId } : {}),
        ...(typeof parsed.createdAt === 'number' ? { createdAt: parsed.createdAt } : {}),
        updatedAt: now
      }
      await writeJsonAtomic(this.conversationPath(parsed.id), {
        version: STORAGE_VERSION,
        conversation: parsed
      } satisfies ConversationFile)

      const index = await this.readConversationIndex()
      const withoutCurrent = index.conversations.filter((item) => item.id !== parsed.id)
      index.conversations = [summary, ...withoutCurrent]
      await writeJsonAtomic(this.indexPath, index)
      return summary
    }))
  }

  removeConversation(id: unknown): Promise<boolean> {
    if (!isConversationId(id)) return Promise.resolve(false)

    return this.ensureProjectMigration().then(() => this.queueWrite(async () => {
      const index = await this.readConversationIndex()
      const exists = index.conversations.some((conversation) => conversation.id === id)
      await rm(this.conversationPath(id), { force: true })
      if (exists) {
        index.conversations = index.conversations.filter((conversation) => conversation.id !== id)
        await writeJsonAtomic(this.indexPath, index)
      }
      return exists
    }))
  }

  async listProjects(): Promise<Project[]> {
    await this.ensureProjectMigration()
    return (await this.readProjectsIndex()).projects.sort((left, right) => {
      if (Boolean(left.archivedAt) !== Boolean(right.archivedAt)) return left.archivedAt ? 1 : -1
      return right.updatedAt - left.updatedAt
    })
  }

  upsertProject(project: unknown): Promise<Project> {
    const input = parseProjectUpsert(project)
    if (!input) return Promise.reject(new Error('Invalid project payload'))

    return this.ensureProjectMigration().then(() => this.queueWrite(async () => {
      const index = await this.readProjectsIndex()
      const canonicalKey = workspaceKey(input.workspace)
      const existing = input.id
        ? index.projects.find((project) => project.id === input.id)
        : index.projects.find((project) => workspaceKey(project.workspace) === canonicalKey)
      const now = Date.now()
      const next: Project = existing
        ? {
            ...existing,
            workspace: input.workspace,
            name: input.name || existing.name || projectName(input.workspace),
            updatedAt: now
          }
        : {
            id: input.id || randomUUID(),
            workspace: input.workspace,
            name: input.name || projectName(input.workspace),
            createdAt: now,
            updatedAt: now
          }
      // Selecting an archived workspace brings the same canonical project back.
      delete next.archivedAt
      index.projects = [next, ...index.projects.filter((project) => project.id !== next.id && workspaceKey(project.workspace) !== canonicalKey)]
      await writeJsonAtomic(this.projectsPath, index)
      return next
    }))
  }

  archiveProject(id: unknown): Promise<Project | null> {
    if (!isConversationId(id)) return Promise.resolve(null)
    return this.ensureProjectMigration().then(() => this.queueWrite(async () => {
      const index = await this.readProjectsIndex()
      const project = index.projects.find((item) => item.id === id)
      if (!project) return null
      const archived: Project = { ...project, archivedAt: Date.now(), updatedAt: Date.now() }
      index.projects = index.projects.map((item) => item.id === id ? archived : item)
      await writeJsonAtomic(this.projectsPath, index)
      return archived
    }))
  }

  async loadUiState(): Promise<UiState> {
    await this.ensureProjectMigration()
    return this.readUiState()
  }

  saveUiState(state: unknown): Promise<UiState> {
    const parsed = parseUiState(state)
    if (!parsed) return Promise.reject(new Error('Invalid UI state payload'))

    return this.ensureProjectMigration().then(() => this.queueWrite(async () => {
      await writeJsonAtomic(this.uiStatePath, {
        version: STORAGE_VERSION,
        state: parsed
      } satisfies UiStateFile)
      return parsed
    }))
  }

  private conversationPath(id: string) {
    return join(this.conversationsDir, `${id}.json`)
  }

  private async readConversationIndex(): Promise<ConversationIndexFile> {
    const data = await readJson(this.indexPath)
    if (!isObject(data) || data.version !== STORAGE_VERSION || !Array.isArray(data.conversations)) {
      return { version: STORAGE_VERSION, conversations: [] }
    }

    const conversations = data.conversations
      .map(parseSummary)
      .filter((conversation): conversation is ConversationSummary => conversation !== null)
    return { version: STORAGE_VERSION, conversations }
  }

  private async readProjectsIndex(): Promise<ProjectsIndexFile> {
    const data = await readJson(this.projectsPath)
    if (!isObject(data) || data.version !== PROJECTS_VERSION || !Array.isArray(data.projects)) {
      return { version: PROJECTS_VERSION, projects: [] }
    }
    return {
      version: PROJECTS_VERSION,
      projects: data.projects.map(parseProject).filter((project): project is Project => project !== null)
    }
  }

  private async readUiState(): Promise<UiState> {
    const data = await readJson(this.uiStatePath)
    if (!isObject(data) || data.version !== STORAGE_VERSION) return defaultUiState()
    return parseUiState(data.state) || defaultUiState()
  }

  private ensureProjectMigration(): Promise<void> {
    if (!this.projectMigration) {
      this.projectMigration = this.queueWrite(() => this.migrateProjects()).catch((error) => {
        this.projectMigration = null
        throw error
      })
    }
    return this.projectMigration
  }

  private async migrateProjects() {
    const [projectIndex, conversationIndex, uiRaw] = await Promise.all([
      this.readProjectsIndex(),
      this.readConversationIndex(),
      readJson(this.uiStatePath)
    ])
    const uiFileIsV1 = isObject(uiRaw) && uiRaw.version === STORAGE_VERSION
    const uiWasLegacy = uiFileIsV1 && isObject(uiRaw.state) &&
      (!Object.hasOwn(uiRaw.state, 'selectedProjectId') || !Object.hasOwn(uiRaw.state, 'expandedProjectIds'))
    const ui = uiFileIsV1 ? parseUiState(uiRaw.state) || defaultUiState() : defaultUiState()
    const byWorkspace = new Map(projectIndex.projects.map((project) => [workspaceKey(project.workspace), project]))
    let projectsChanged = false

    const ensureProject = (workspaceValue: unknown, createdAt = Date.now()) => {
      const workspace = canonicalWorkspace(workspaceValue)
      if (!workspace) return undefined
      const key = workspaceKey(workspace)
      let project = byWorkspace.get(key)
      if (!project) {
        project = {
          id: randomUUID(),
          name: projectName(workspace),
          workspace,
          createdAt,
          updatedAt: createdAt
        }
        projectIndex.projects.push(project)
        byWorkspace.set(key, project)
        projectsChanged = true
      }
      return project
    }

    ensureProject(ui.selectedWorkspace)
    for (const workspace of ui.recentWorkspaces) ensureProject(workspace)
    for (const summary of conversationIndex.conversations) ensureProject(summary.workspace, summary.createdAt || summary.updatedAt)

    let conversationsChanged = false
    const migratedSummaries: ConversationSummary[] = []
    for (const summary of conversationIndex.conversations) {
      const rawConversationFile = await readJson(this.conversationPath(summary.id))
      const conversation = isObject(rawConversationFile) && rawConversationFile.version === STORAGE_VERSION
        ? parseConversation(rawConversationFile.conversation)
        : null
      // Older indexes can omit workspace even when the v1 conversation contains it.
      const conversationWorkspace = conversation?.workspace || summary.workspace
      const project = summary.projectId || conversation?.projectId
        ? undefined
        : ensureProject(conversationWorkspace, summary.createdAt || summary.updatedAt)
      const projectId = summary.projectId || conversation?.projectId || project?.id
      const migrated: ConversationSummary = {
        ...summary,
        ...(conversationWorkspace && !summary.workspace ? { workspace: conversationWorkspace } : {}),
        ...(projectId && !summary.projectId ? { projectId } : {})
      }
      if (JSON.stringify(migrated) !== JSON.stringify(summary)) conversationsChanged = true
      migratedSummaries.push(migrated)

      if (!conversation || conversation.projectId || !projectId) continue
      await writeJsonAtomic(this.conversationPath(summary.id), {
        version: STORAGE_VERSION,
        conversation: { ...conversation, projectId }
      } satisfies ConversationFile)
    }
    if (projectsChanged) await writeJsonAtomic(this.projectsPath, projectIndex)
    if (conversationsChanged) {
      conversationIndex.conversations = migratedSummaries
      await writeJsonAtomic(this.indexPath, conversationIndex)
    }

    if (uiWasLegacy) {
      const selected = canonicalWorkspace(ui.selectedWorkspace)
      const selectedProject = selected ? byWorkspace.get(workspaceKey(selected)) : undefined
      const migratedUi: UiState = {
        ...ui,
        selectedProjectId: selectedProject?.id || null,
        expandedProjectIds: projectIndex.projects.filter((project) => !project.archivedAt).map((project) => project.id)
      }
      await writeJsonAtomic(this.uiStatePath, { version: STORAGE_VERSION, state: migratedUi } satisfies UiStateFile)
    }
  }

  private queueWrite<T>(work: () => Promise<T>): Promise<T> {
    const next = this.writes.then(work, work)
    this.writes = next.then(
      () => undefined,
      () => undefined
    )
    return next
  }
}
