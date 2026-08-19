import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { dirname, join } from 'node:path'

const STORAGE_VERSION = 1
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
  createdAt?: number
}

export interface ConversationSummary {
  id: string
  title: string
  workspace?: string
  createdAt?: number
  updatedAt: number
}

export interface UiState {
  selectedWorkspace: string | null
  recentWorkspaces: string[]
  currentConversationId: string | null
  rightPanelTab: string
  repo: JsonObject | null
}

interface ConversationIndexFile {
  version: typeof STORAGE_VERSION
  conversations: ConversationSummary[]
}

interface ConversationFile {
  version: typeof STORAGE_VERSION
  conversation: SerializedConversation
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

function parseConversation(value: unknown): SerializedConversation | null {
  if (!isObject(value) || !isConversationId(value.id) || !isJsonValue(value)) return null
  if (value.title !== undefined && typeof value.title !== 'string') return null
  if (value.workspace !== undefined && typeof value.workspace !== 'string') return null
  if (value.createdAt !== undefined && !isFiniteTimestamp(value.createdAt)) return null
  return value as SerializedConversation
}

function parseSummary(value: unknown): ConversationSummary | null {
  if (!isObject(value) || !isConversationId(value.id) || typeof value.title !== 'string') return null
  if (value.workspace !== undefined && typeof value.workspace !== 'string') return null
  if (value.createdAt !== undefined && !isFiniteTimestamp(value.createdAt)) return null
  if (!isFiniteTimestamp(value.updatedAt)) return null

  return {
    id: value.id,
    title: value.title,
    ...(typeof value.workspace === 'string' ? { workspace: value.workspace } : {}),
    ...(typeof value.createdAt === 'number' ? { createdAt: value.createdAt } : {}),
    updatedAt: value.updatedAt
  }
}

function defaultUiState(): UiState {
  return {
    selectedWorkspace: null,
    recentWorkspaces: [],
    currentConversationId: null,
    rightPanelTab: 'github',
    repo: null
  }
}

function parseUiState(value: unknown): UiState | null {
  if (!isObject(value)) return null
  const selectedWorkspace = value.selectedWorkspace
  const recentWorkspaces = value.recentWorkspaces
  const currentConversationId = value.currentConversationId
  const rightPanelTab = value.rightPanelTab
  const repo = value.repo

  if (selectedWorkspace !== null && typeof selectedWorkspace !== 'string') return null
  if (!Array.isArray(recentWorkspaces) || recentWorkspaces.length > MAX_WORKSPACES) return null
  if (!recentWorkspaces.every((workspace) => typeof workspace === 'string')) return null
  if (currentConversationId !== undefined && currentConversationId !== null && !isConversationId(currentConversationId)) return null
  if (typeof rightPanelTab !== 'string') return null
  if (repo !== null && (!isObject(repo) || !isJsonValue(repo))) return null

  return {
    selectedWorkspace,
    recentWorkspaces: [...recentWorkspaces],
    currentConversationId: typeof currentConversationId === 'string' ? currentConversationId : null,
    rightPanelTab,
    repo: repo === null ? null : (repo as JsonObject)
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
  private readonly uiStatePath: string
  private writes = Promise.resolve()

  constructor(userDataPath: string) {
    const root = join(userDataPath, 'state')
    this.conversationsDir = join(root, 'conversations')
    this.indexPath = join(this.conversationsDir, 'index.json')
    this.uiStatePath = join(root, 'ui-state.json')
  }

  async listConversations(): Promise<ConversationSummary[]> {
    const index = await this.readConversationIndex()
    return index.conversations
  }

  async loadConversation(id: unknown): Promise<SerializedConversation | null> {
    if (!isConversationId(id)) return null
    const data = await readJson(this.conversationPath(id))
    if (!isObject(data) || data.version !== STORAGE_VERSION) return null
    return parseConversation(data.conversation)
  }

  saveConversation(conversation: unknown): Promise<ConversationSummary> {
    const parsed = parseConversation(conversation)
    if (!parsed) return Promise.reject(new Error('Invalid conversation payload'))

    return this.queueWrite(async () => {
      const now = Date.now()
      const summary: ConversationSummary = {
        id: parsed.id,
        title: parsed.title || 'Untitled conversation',
        ...(parsed.workspace ? { workspace: parsed.workspace } : {}),
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
    })
  }

  removeConversation(id: unknown): Promise<boolean> {
    if (!isConversationId(id)) return Promise.resolve(false)

    return this.queueWrite(async () => {
      const index = await this.readConversationIndex()
      const exists = index.conversations.some((conversation) => conversation.id === id)
      await rm(this.conversationPath(id), { force: true })
      if (exists) {
        index.conversations = index.conversations.filter((conversation) => conversation.id !== id)
        await writeJsonAtomic(this.indexPath, index)
      }
      return exists
    })
  }

  async loadUiState(): Promise<UiState> {
    const data = await readJson(this.uiStatePath)
    if (!isObject(data) || data.version !== STORAGE_VERSION) return defaultUiState()
    return parseUiState(data.state) || defaultUiState()
  }

  saveUiState(state: unknown): Promise<UiState> {
    const parsed = parseUiState(state)
    if (!parsed) return Promise.reject(new Error('Invalid UI state payload'))

    return this.queueWrite(async () => {
      await writeJsonAtomic(this.uiStatePath, {
        version: STORAGE_VERSION,
        state: parsed
      } satisfies UiStateFile)
      return parsed
    })
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

  private queueWrite<T>(work: () => Promise<T>): Promise<T> {
    const next = this.writes.then(work, work)
    this.writes = next.then(
      () => undefined,
      () => undefined
    )
    return next
  }
}
