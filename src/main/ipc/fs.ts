import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile, readdir } from 'node:fs/promises'
import { join, resolve, relative, sep } from 'node:path'

export interface FileState {
  exists: boolean
  content: string | null
  sha256: string | null
  size: number
}

export interface FileChangeSnapshot {
  path: string
  operation: 'create' | 'modify' | 'delete'
  before: FileState
  after: FileState
}

export interface WriteContext {
  conversationId: string
  turnId: string
  toolCallId: string
}

// All file operations are confined to the workspace to prevent traversal.
export function confine(workspace: string, rel: string): string {
  if (typeof workspace !== 'string' || !workspace.trim()) throw new Error('Workspace path is required')
  if (typeof rel !== 'string' || !rel.trim()) throw new Error('File path is required')
  const root = resolve(workspace)
  const target = resolve(root, rel)
  if (target !== root && !target.startsWith(root + sep)) {
    throw new Error(`Path escapes workspace: ${rel}`)
  }
  return target
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
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return { exists: false, content: null, sha256: null, size: 0 }
    }
    throw error
  }
}

const writeQueues = new Map<string, Promise<void>>()

export async function readFileIn(workspace: string, rel: string): Promise<string> {
  return readFile(confine(workspace, rel), 'utf-8')
}

function queueWrite<T>(target: string, operation: () => Promise<T>): Promise<T> {
  const previous = writeQueues.get(target) || Promise.resolve()
  const current = previous.then(operation)
  const settled = current.then(() => undefined, () => undefined)
  writeQueues.set(target, settled)
  void settled.then(() => {
    if (writeQueues.get(target) === settled) writeQueues.delete(target)
  })
  return current
}

function snapshotFor(workspace: string, target: string, before: FileState, after: FileState): FileChangeSnapshot {
  return {
    path: relative(resolve(workspace), target).split(sep).join('/'),
    operation: before.exists ? 'modify' : 'create',
    before,
    after
  }
}

export function writeFileIn(workspace: string, rel: string, content: string): Promise<FileChangeSnapshot> {
  if (typeof content !== 'string') throw new Error('File content must be a string')
  const target = confine(workspace, rel)
  return queueWrite(target, async () => {
    const before = await readState(target)
    await mkdir(resolve(target, '..'), { recursive: true })
    await writeFile(target, content, 'utf-8')
    return snapshotFor(workspace, target, before, await readState(target))
  })
}

export function incrementallyEditFileIn(
  workspace: string,
  rel: string,
  oldString: string,
  newString: string,
  replaceAll = false
): Promise<FileChangeSnapshot> {
  if (typeof oldString !== 'string' || !oldString) throw new Error('old_string must be a non-empty string')
  if (typeof newString !== 'string') throw new Error('new_string must be a string')
  if (typeof replaceAll !== 'boolean') throw new Error('replace_all must be a boolean')

  const target = confine(workspace, rel)
  return queueWrite(target, async () => {
    const before = await readState(target)
    if (!before.exists || before.content === null) throw new Error(`File not found: ${rel}`)

    const firstMatch = before.content.indexOf(oldString)
    if (firstMatch < 0) throw new Error('old_string was not found in the current file')
    const secondMatch = before.content.indexOf(oldString, firstMatch + oldString.length)
    if (!replaceAll && secondMatch >= 0) {
      throw new Error('old_string matched multiple locations; provide more context or set replace_all to true')
    }

    const content = replaceAll
      ? before.content.split(oldString).join(newString)
      : `${before.content.slice(0, firstMatch)}${newString}${before.content.slice(firstMatch + oldString.length)}`
    await writeFile(target, content, 'utf-8')
    return snapshotFor(workspace, target, before, await readState(target))
  })
}

export async function snapshotWorkspace(workspace: string): Promise<Map<string, FileState>> {
  const root = resolve(workspace)
  const result = new Map<string, FileState>()
  const walk = async (dir: string) => {
    let entries
    try { entries = await readdir(dir, { withFileTypes: true }) } catch { return }
    for (const entry of entries) {
      if (entry.name === '.git' || entry.name === 'node_modules' || entry.name === 'out' || entry.name === 'dist') continue
      const absolute = join(dir, entry.name)
      if (entry.isDirectory()) {
        await walk(absolute)
        continue
      }
      try {
        const buffer = await readFile(absolute)
        if (buffer.byteLength > 512 * 1024 || buffer.includes(0)) continue
        const relativePath = relative(root, absolute).split(sep).join('/')
        result.set(relativePath, stateFromBuffer(buffer))
      } catch {
        // Ignore files that cannot be read as text snapshots.
      }
    }
  }
  await walk(root)
  return result
}

export async function listDir(workspace: string, rel = '.') {
  const dir = confine(workspace, rel)
  const entries = await readdir(dir, { withFileTypes: true })
  const out: { name: string; path: string; type: 'file' | 'dir' }[] = []
  for (const e of entries) {
    if (e.name === '.git' || e.name === 'node_modules') continue
    out.push({
      name: e.name,
      path: relative(resolve(workspace), join(dir, e.name)).split(sep).join('/'),
      type: e.isDirectory() ? 'dir' : 'file'
    })
  }
  return out
}
