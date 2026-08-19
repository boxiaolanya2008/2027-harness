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

export function writeFileIn(
  workspace: string,
  rel: string,
  content: string
): Promise<FileChangeSnapshot> {
  const target = confine(workspace, rel)
  const previous = writeQueues.get(target) || Promise.resolve()
  const current = previous.then(async () => {
    const before = await readState(target)
    await mkdir(resolve(target, '..'), { recursive: true })
    await writeFile(target, content, 'utf-8')
    const after = await readState(target)
    return {
      path: relative(resolve(workspace), target).split(sep).join('/'),
      operation: before.exists ? 'modify' : 'create',
      before,
      after
    } satisfies FileChangeSnapshot
  })
  const settled = current.then(() => undefined, () => undefined)
  writeQueues.set(target, settled)
  void settled.then(() => {
    if (writeQueues.get(target) === settled) writeQueues.delete(target)
  })
  return current
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
