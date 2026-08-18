import { readFile, writeFile, readdir, stat } from 'node:fs/promises'
import { join, resolve, relative, sep } from 'node:path'

// 所有文件操作限定在 workspace 内，防止越界
function confine(workspace: string, rel: string): string {
  const root = resolve(workspace)
  const target = resolve(root, rel)
  if (target !== root && !target.startsWith(root + sep)) {
    throw new Error(`路径越界: ${rel}`)
  }
  return target
}

export async function readFileIn(workspace: string, rel: string): Promise<string> {
  return readFile(confine(workspace, rel), 'utf-8')
}

export async function writeFileIn(workspace: string, rel: string, content: string) {
  await writeFile(confine(workspace, rel), content, 'utf-8')
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
