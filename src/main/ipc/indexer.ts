import { readdirSync, readFileSync, statSync, existsSync, writeFileSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

const SKIP_DIRS = new Set(['.git', 'node_modules', 'dist', 'out', '.next', '.nuxt', 'build', 'coverage'])
const SKIP_EXT = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.webp', '.woff', '.woff2', '.ttf',
  '.pdf', '.zip', '.gz', '.tar', '.exe', '.dll', '.so', '.dylib', '.lock'
])
const MAX_FILE = 512 * 1024
const CHUNK = 1200

export interface IndexChunk {
  file: string
  start: number
  text: string
}

export interface WorkspaceIndex {
  root: string
  files: string[]
  chunks: IndexChunk[]
  df: Record<string, number>
  nDocs: number
}

export interface SearchHit {
  file: string
  score: number
  snippet: string
}

// 混合分词：ASCII 词 + CJK 二元组，中文也能检索
function tokenize(text: string): string[] {
  const lower = text.toLowerCase()
  const tokens: string[] = []
  const ascii = lower.match(/[a-z0-9_]+/g)
  if (ascii) tokens.push(...ascii)
  const cjk = lower.match(/[\u4e00-\u9fff]+/g)
  if (cjk) {
    for (const seg of cjk) {
      if (seg.length === 1) tokens.push(seg)
      else for (let i = 0; i < seg.length - 1; i++) tokens.push(seg.slice(i, i + 2))
    }
  }
  return tokens
}

function collectFiles(root: string): string[] {
  const out: string[] = []
  const walk = (dir: string) => {
    let entries
    try {
      entries = readdirSync(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const e of entries) {
      if (e.isDirectory()) {
        if (!SKIP_DIRS.has(e.name)) walk(join(dir, e.name))
      } else if (e.isFile()) {
        const ext = e.name.slice(e.name.lastIndexOf('.')).toLowerCase()
        if (!SKIP_EXT.has(ext)) out.push(join(dir, e.name))
      }
    }
  }
  walk(root)
  return out
}

export function buildIndex(root: string): WorkspaceIndex {
  const files = collectFiles(root)
  const chunks: IndexChunk[] = []
  const df: Record<string, number> = {}

  for (const file of files) {
    let content: string
    try {
      if (statSync(file).size > MAX_FILE) continue
      content = readFileSync(file, 'utf-8')
    } catch {
      continue
    }
    const rel = relative(root, file).split(sep).join('/')
    const terms = new Set(tokenize(content))
    for (const t of terms) df[t] = (df[t] || 0) + 1

    let added = false
    for (let i = 0; i < content.length; i += CHUNK) {
      chunks.push({ file: rel, start: i, text: content.slice(i, i + CHUNK) })
      added = true
    }
    if (!added) chunks.push({ file: rel, start: 0, text: content })
  }

  return { root, files, chunks, df, nDocs: files.length }
}

function tfidf(tokens: string[], df: Record<string, number>, nDocs: number): Map<string, number> {
  const freq = new Map<string, number>()
  for (const t of tokens) freq.set(t, (freq.get(t) || 0) + 1)
  const vec = new Map<string, number>()
  for (const [t, f] of freq) {
    const idf = Math.log((nDocs + 1) / ((df[t] || 0) + 1)) + 1
    vec.set(t, f * idf)
  }
  return vec
}

function cosine(a: Map<string, number>, b: Map<string, number>): number {
  let dot = 0
  let na = 0
  let nb = 0
  for (const v of a.values()) na += v * v
  for (const v of b.values()) nb += v * v
  for (const [t, v] of a) if (b.has(t)) dot += v * b.get(t)!
  return dot / (Math.sqrt(na) * Math.sqrt(nb) || 1)
}

export function searchIndex(index: WorkspaceIndex, query: string): SearchHit[] {
  const qVec = tfidf(tokenize(query), index.df, index.nDocs)
  if (qVec.size === 0) return []

  const hits: SearchHit[] = []
  for (const chunk of index.chunks) {
    const vec = tfidf(tokenize(chunk.text), index.df, index.nDocs)
    const score = cosine(qVec, vec)
    if (score > 0.02) hits.push({ file: chunk.file, score, snippet: chunk.text.slice(0, CHUNK) })
  }
  hits.sort((a, b) => b.score - a.score)
  return hits.slice(0, 8)
}

export function loadIndex(root: string): WorkspaceIndex | null {
  const p = join(root, '.super-agent-index.json')
  if (!existsSync(p)) return null
  try {
    return JSON.parse(readFileSync(p, 'utf-8'))
  } catch {
    return null
  }
}

export function saveIndex(index: WorkspaceIndex) {
  writeFileSync(join(index.root, '.super-agent-index.json'), JSON.stringify(index), 'utf-8')
}
