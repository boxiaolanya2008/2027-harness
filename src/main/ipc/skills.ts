import { readFile, readdir } from 'node:fs/promises'
import { confine } from './fs'

export interface SkillSummary {
  name: string
  description: string
  path: string
}

export interface SkillDetail extends SkillSummary {
  content: string
  truncated: boolean
}

const SKILL_NAME_RE = /^[a-z0-9][a-z0-9-_]{0,63}$/
const SKILL_CONTENT_LIMIT = 256 * 1024

function isValidSkillName(name: string) {
  return SKILL_NAME_RE.test(name)
}

function parseSkillFrontmatter(raw: string, fallbackName: string): { name: string; description: string; body: string } {
  const text = String(raw || '')
  const frontmatter = text.match(/^---\s*\r?\n([\s\S]*?)\r?\n---\s*\r?\n?([\s\S]*)$/)
  if (!frontmatter) {
    const firstLine = text.split(/\r?\n/).find((line) => line.trim()) || ''
    return { name: fallbackName, description: firstLine.slice(0, 160), body: text }
  }
  const header = frontmatter[1]
  const body = frontmatter[2] || ''
  const pick = (key: string) => {
    const match = header.match(new RegExp(`^\\s*${key}\\s*:\\s*(.+)$`, 'm'))
    if (!match) return ''
    return match[1].trim().replace(/^['"]|['"]$/g, '').slice(0, 200)
  }
  const name = pick('name') || fallbackName
  const description = pick('description') || body.split(/\r?\n/).find((line) => line.trim())?.slice(0, 160) || ''
  return { name, description, body: body.trimStart() ? body : text }
}

function toSkillSummary(dirName: string, raw: string): SkillSummary | null {
  if (!isValidSkillName(dirName)) return null
  const parsed = parseSkillFrontmatter(raw, dirName)
  if (!isValidSkillName(parsed.name)) return null
  return {
    name: parsed.name,
    description: parsed.description,
    path: `.claude/skills/${dirName}/SKILL.md`,
  }
}

export async function listSkills(workspace: string): Promise<SkillSummary[]> {
  if (typeof workspace !== 'string' || !workspace.trim()) return []
  let entries: import('node:fs').Dirent[]
  try {
    const skillsRoot = confine(workspace, '.claude/skills')
    entries = await readdir(skillsRoot, { withFileTypes: true })
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []
    throw error
  }

  const summaries: SkillSummary[] = []
  await Promise.all(
    entries
      .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
      .map(async (entry) => {
        try {
          const raw = await readFile(confine(workspace, `.claude/skills/${entry.name}/SKILL.md`), 'utf-8')
          const summary = toSkillSummary(entry.name, raw)
          if (summary) summaries.push(summary)
        } catch {
          // Missing or unreadable SKILL.md is not a fatal error for the listing.
        }
      }),
  )
  summaries.sort((left, right) => left.name.localeCompare(right.name))
  return summaries
}

export async function readSkill(workspace: string, name: string): Promise<SkillDetail> {
  if (typeof workspace !== 'string' || !workspace.trim()) throw new Error('Workspace path is required')
  if (typeof name !== 'string' || !isValidSkillName(name.trim())) throw new Error(`Invalid skill name: ${name}`)
  const normalized = name.trim()

  // Workspace-relative discovery must not allow directory traversal or cross-skill reads.
  const summaries = await listSkills(workspace)
  const matched = summaries.find((item) => item.name === normalized)
  if (!matched) throw new Error(`Skill not found: ${normalized}`)

  const dirName = matched.path.split('/')[2]
  const raw = await readFile(confine(workspace, `.claude/skills/${dirName}/SKILL.md`), 'utf-8')
  const parsed = parseSkillFrontmatter(raw, matched.name)
  const body = parsed.body || raw
  const truncated = Buffer.byteLength(body, 'utf-8') > SKILL_CONTENT_LIMIT
  const content = truncated ? body.slice(0, SKILL_CONTENT_LIMIT) : body
  return {
    name: parsed.name,
    description: parsed.description || matched.description,
    path: matched.path,
    content,
    truncated,
  }
}
