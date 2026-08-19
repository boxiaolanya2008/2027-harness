import { createHash, randomUUID } from 'node:crypto'
import { mkdir, readFile, rm, writeFile, rename } from 'node:fs/promises'
import { dirname, join, resolve, sep } from 'node:path'
import type { FileChangeSnapshot, FileState } from '../ipc/fs'

const STORAGE_VERSION = 1
const MAX_JSON_BYTES = 100 * 1024 * 1024
const MAX_CHANGES = 10_000
const MAX_ID_LENGTH = 128
const SAFE_ID = /^[A-Za-z0-9_-]{1,128}$/
const SHA256 = /^[a-f0-9]{64}$/
const MAX_PATH_LENGTH = 4096

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

interface JournalFile {
  version: typeof STORAGE_VERSION
  changes: ChangeRecord[]
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isSafeId(value: unknown): value is string {
  return typeof value === 'string' && value.length <= MAX_ID_LENGTH && SAFE_ID.test(value)
}

function isJsonValue(value: unknown, depth = 0): boolean {
  if (depth > 50) return false
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true
  if (typeof value === 'number') return Number.isFinite(value)
  if (Array.isArray(value)) return value.every((item) => isJsonValue(item, depth + 1))
  return isObject(value) && Object.values(value).every((item) => isJsonValue(item, depth + 1))
}

function isSafePath(value: unknown): value is string {
  if (typeof value !== 'string' || value.length === 0 || value.length > MAX_PATH_LENGTH) return false
  if (value.startsWith('/') || value.startsWith('\\') || /^[A-Za-z]:/.test(value)) return false
  const parts = value.replaceAll('\\', '/').split('/')
  return parts.every((part) => part.length > 0 && part !== '..')
}

function isFileState(value: unknown): value is FileState {
  if (!isObject(value) || typeof value.exists !== 'boolean') return false
  const size = value.size
  if (typeof size !== 'number' || !Number.isSafeInteger(size) || size < 0) return false
  if (!value.exists) return value.content === null && value.sha256 === null && size === 0
  if (typeof value.content !== 'string' || typeof value.sha256 !== 'string' || !SHA256.test(value.sha256)) return false
  const buffer = Buffer.from(value.content, 'utf-8')
  return buffer.byteLength === size && createHash('sha256').update(buffer).digest('hex') === value.sha256
}

function parseContext(value: unknown): ChangeContext | null {
  if (!isObject(value) || !isSafeId(value.conversationId) || !isSafeId(value.turnId) || !isSafeId(value.toolCallId)) {
    return null
  }
  return {
    conversationId: value.conversationId,
    turnId: value.turnId,
    toolCallId: value.toolCallId
  }
}

export function parseWriteContext(value: unknown): ChangeContext | null {
  return parseContext(value)
}

function parseChange(value: unknown): ChangeRecord | null {
  if (!isObject(value)) return null
  if (!isSafeId(value.id) || !isSafeId(value.conversationId) || !isSafeId(value.turnId) || !isSafeId(value.toolCallId)) {
    return null
  }
  if (typeof value.workspace !== 'string' || value.workspace.length === 0 || value.workspace.length > MAX_PATH_LENGTH) return null
  if (!isSafePath(value.path) || !isFileState(value.before) || !isFileState(value.after)) return null
  if (value.operation !== 'create' && value.operation !== 'modify' && value.operation !== 'delete' && value.operation !== 'restore') {
    return null
  }
  const timestamp = value.timestamp
  if (typeof timestamp !== 'number' || !Number.isSafeInteger(timestamp) || timestamp < 0) return null
  if (value.restoreOf !== undefined && !isSafeId(value.restoreOf)) return null
  if (!isJsonValue(value)) return null
  return {
    id: value.id,
    conversationId: value.conversationId,
    turnId: value.turnId,
    toolCallId: value.toolCallId,
    workspace: value.workspace,
    path: value.path,
    operation: value.operation,
    before: value.before,
    after: value.after,
    timestamp,
    ...(typeof value.restoreOf === 'string' ? { restoreOf: value.restoreOf } : {})
  }
}

function parseListRequest(value: unknown): ChangesListRequest {
  if (value === undefined) return {}
  if (!isObject(value)) throw new Error('Invalid changes list payload')
  for (const key of ['conversationId', 'turnId', 'toolCallId'] as const) {
    if (value[key] !== undefined && !isSafeId(value[key])) throw new Error('Invalid changes list payload')
  }
  if (value.workspace !== undefined && (typeof value.workspace !== 'string' || value.workspace.length === 0 || value.workspace.length > MAX_PATH_LENGTH)) {
    throw new Error('Invalid changes list payload')
  }
  return {
    ...(typeof value.conversationId === 'string' ? { conversationId: value.conversationId } : {}),
    ...(typeof value.turnId === 'string' ? { turnId: value.turnId } : {}),
    ...(typeof value.toolCallId === 'string' ? { toolCallId: value.toolCallId } : {}),
    ...(typeof value.workspace === 'string' ? { workspace: value.workspace } : {})
  }
}

function parseRestoreFileRequest(value: unknown): RestoreFileRequest {
  if (!isObject(value) || !isSafeId(value.changeId) || (value.force !== undefined && typeof value.force !== 'boolean')) {
    throw new Error('Invalid restore file payload')
  }
  return { changeId: value.changeId, force: value.force === true }
}

function parseRestoreBatchRequest(value: unknown): RestoreBatchRequest {
  if (!isObject(value) || !Array.isArray(value.changeIds) || value.changeIds.length === 0 || value.changeIds.length > MAX_CHANGES) {
    throw new Error('Invalid restore batch payload')
  }
  if (!value.changeIds.every((id) => isSafeId(id)) || (value.force !== undefined && typeof value.force !== 'boolean')) {
    throw new Error('Invalid restore batch payload')
  }
  return { changeIds: [...value.changeIds], force: value.force === true }
}

async function readJson(filePath: string): Promise<unknown | null> {
  try {
    return JSON.parse(await readFile(filePath, 'utf-8'))
  } catch {
    return null
  }
}

async function writeJsonAtomic(filePath: string, value: JournalFile): Promise<void> {
  const json = JSON.stringify(value)
  if (Buffer.byteLength(json, 'utf-8') > MAX_JSON_BYTES) throw new Error('Change journal is too large to persist')
  await mkdir(dirname(filePath), { recursive: true })
  const tempPath = `${filePath}.${process.pid}.${randomUUID()}.tmp`
  try {
    await writeFile(tempPath, json, { encoding: 'utf-8', flag: 'wx' })
    await rename(tempPath, filePath)
  } finally {
    await rm(tempPath, { force: true }).catch(() => undefined)
  }
}

function stateFromBuffer(buffer: Buffer): FileState {
  return {
    exists: true,
    content: buffer.toString('utf-8'),
    sha256: createHash('sha256').update(buffer).digest('hex'),
    size: buffer.byteLength
  }
}

async function readState(filePath: string): Promise<FileState> {
  try {
    return stateFromBuffer(await readFile(filePath))
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { exists: false, content: null, sha256: null, size: 0 }
    throw error
  }
}

function statesEqual(left: FileState, right: FileState): boolean {
  return left.exists === right.exists && left.sha256 === right.sha256 && left.size === right.size
}

function operationFor(before: FileState, after: FileState): ChangeRecord['operation'] {
  if (!before.exists && after.exists) return 'create'
  if (before.exists && !after.exists) return 'delete'
  return 'modify'
}

export class ChangeJournal {
  private readonly journalPath: string
  private writes = Promise.resolve()

  constructor(userDataPath: string) {
    this.journalPath = join(userDataPath, 'state', 'change-journal.json')
  }

  record(context: unknown, workspace: unknown, snapshot: FileChangeSnapshot): Promise<ChangeRecord> {
    const parsedContext = parseContext(context)
    if (!parsedContext || typeof workspace !== 'string' || workspace.length === 0 || workspace.length > MAX_PATH_LENGTH) {
      return Promise.reject(new Error('Invalid change context'))
    }
    if (!isSafePath(snapshot.path) || !isFileState(snapshot.before) || !isFileState(snapshot.after)) {
      return Promise.reject(new Error('Invalid file change snapshot'))
    }
    const record: ChangeRecord = {
      ...parsedContext,
      id: randomUUID(),
      workspace: resolve(workspace),
      path: snapshot.path,
      operation: operationFor(snapshot.before, snapshot.after),
      before: snapshot.before,
      after: snapshot.after,
      timestamp: Date.now()
    }
    return this.queueWrite(async () => {
      const journal = await this.readJournal()
      journal.changes.push(record)
      if (journal.changes.length > MAX_CHANGES) journal.changes.splice(0, journal.changes.length - MAX_CHANGES)
      await writeJsonAtomic(this.journalPath, journal)
      return record
    })
  }

  async listChanges(value?: unknown): Promise<AggregatedChange[]> {
    const filter = parseListRequest(value)
    const changes = (await this.readJournal()).changes.filter((change) =>
      (filter.conversationId === undefined || change.conversationId === filter.conversationId) &&
      (filter.turnId === undefined || change.turnId === filter.turnId) &&
      (filter.toolCallId === undefined || change.toolCallId === filter.toolCallId) &&
      (filter.workspace === undefined || resolve(filter.workspace) === change.workspace)
    )
    const groups = new Map<string, ChangeRecord[]>()
    for (const change of changes) {
      const key = `${change.workspace}\u0000${change.path}`
      const group = groups.get(key) || []
      group.push(change)
      groups.set(key, group)
    }
    return [...groups.values()].map((group) => {
      const latest = group[group.length - 1]
      const first = group[0]
      return {
        workspace: latest.workspace,
        path: latest.path,
        operation: latest.operation,
        before: first.before,
        after: latest.after,
        latestChangeId: latest.id,
        latestTimestamp: latest.timestamp,
        changeIds: group.map((change) => change.id),
        changeCount: group.length,
        conversationIds: [...new Set(group.map((change) => change.conversationId))],
        turnIds: [...new Set(group.map((change) => change.turnId))],
        toolCallIds: [...new Set(group.map((change) => change.toolCallId))]
      }
    })
  }

  restoreFile(value: unknown): Promise<RestoreResult> {
    const request = parseRestoreFileRequest(value)
    return this.queueWrite(() => this.restoreChanges([request.changeId], request.force === true)).then((results) => results[0])
  }

  restoreBatch(value: unknown): Promise<RestoreResult[]> {
    const request = parseRestoreBatchRequest(value)
    return this.queueWrite(() => this.restoreChanges(request.changeIds, request.force === true))
  }

  private async restoreChanges(changeIds: string[], force: boolean): Promise<RestoreResult[]> {
    const journal = await this.readJournal()
    const changes = changeIds.map((id) => journal.changes.find((change) => change.id === id))
    if (changes.some((change): change is undefined => change === undefined)) throw new Error('Change record not found')
    const records = changes as ChangeRecord[]
    const grouped = new Map<string, ChangeRecord[]>()
    for (const change of records) {
      const key = `${change.workspace}\u0000${change.path}`
      const history = journal.changes.filter((item) => item.workspace === change.workspace && item.path === change.path && item.timestamp <= change.timestamp && item.operation !== 'restore')
      grouped.set(key, [...history, change].sort((a, b) => a.timestamp - b.timestamp))
    }
    const targets = [...grouped.values()].map((history) => {
      const change = history[history.length - 1]
      return { change, before: history[0].before, path: resolve(change.workspace, change.path) }
    })

    if (!force) {
      for (const { change, path } of targets) {
        const current = await readState(path)
        if (!statesEqual(current, change.after)) {
          throw new Error(`Restore conflict for ${change.workspace}/${change.path}`)
        }
      }
    }

    const results: RestoreResult[] = []
    for (const { change, before, path } of targets) {
      const current = await readState(path)
      if (before.exists) {
        await mkdir(dirname(path), { recursive: true })
        await writeFile(path, before.content as string, 'utf-8')
      } else {
        await rm(path, { force: true })
      }
      const after = await readState(path)
      const restoreRecord: ChangeRecord = {
        conversationId: change.conversationId,
        turnId: change.turnId,
        toolCallId: change.toolCallId,
        id: randomUUID(),
        workspace: change.workspace,
        path: change.path,
        operation: 'restore',
        before: current,
        after,
        timestamp: Date.now(),
        restoreOf: change.id
      }
      journal.changes.push(restoreRecord)
      results.push({
        changeId: change.id,
        restoreChangeId: restoreRecord.id,
        workspace: change.workspace,
        path: change.path,
        forced: force
      })
    }
    if (journal.changes.length > MAX_CHANGES) journal.changes.splice(0, journal.changes.length - MAX_CHANGES)
    await writeJsonAtomic(this.journalPath, journal)
    return results
  }

  private async readJournal(): Promise<JournalFile> {
    const data = await readJson(this.journalPath)
    if (!isObject(data) || data.version !== STORAGE_VERSION || !Array.isArray(data.changes)) {
      return { version: STORAGE_VERSION, changes: [] }
    }
    const changes = data.changes
      .map(parseChange)
      .filter((change): change is ChangeRecord => change !== null)
    return { version: STORAGE_VERSION, changes }
  }

  private queueWrite<T>(work: () => Promise<T>): Promise<T> {
    const next = this.writes.then(work, work)
    this.writes = next.then(() => undefined, () => undefined)
    return next
  }
}
