import { ref, watch } from 'vue'
import type { SkillDetail, SkillSummary } from '@/types'

const skills = ref<SkillSummary[]>([])
const loading = ref(false)
const workspaceRef = ref<string | null>(null)
let lastLoadedAt = 0
let bound = false

async function refresh(force = false) {
  try {
    if (localStorage.getItem('codex_plugin_enabled') === 'false') {
      skills.value = []
      return
    }
  } catch {}
  const workspace = workspaceRef.value
  if (!workspace) {
    skills.value = []
    return
  }
  if (!force && Date.now() - lastLoadedAt < 30_000 && skills.value.length) return
  loading.value = true
  try {
    const result = (await window.api.skills.list(workspace)) as SkillSummary[]
    skills.value = Array.isArray(result) ? result : []
    lastLoadedAt = Date.now()
  } catch {
    skills.value = []
  } finally {
    loading.value = false
  }
}

function isPluginEnabled(): boolean {
  try { return localStorage.getItem('codex_plugin_enabled') !== 'false' } catch { return true }
}

function bindWorkspace(source: () => string | null | undefined) {
  if (bound) return
  bound = true
  watch(
    source,
    (next) => {
      workspaceRef.value = next || null
      lastLoadedAt = 0
      void refresh(true)
    },
    { immediate: true },
  )
}

async function readSkill(name: string): Promise<SkillDetail | null> {
  const workspace = workspaceRef.value
  if (!workspace || !name) return null
  try {
    const detail = (await window.api.skills.read(workspace, name)) as SkillDetail
    return detail || null
  } catch {
    return null
  }
}

export function useSkills() {
  return { skills, loading, refresh: () => refresh(true), readSkill, bindWorkspace }
}

export async function resolveSkillContext(text: string, workspace: string | null): Promise<{ skillContext: string; slashName: string | null; atNames: string[] }> {
  if (!isPluginEnabled()) return { skillContext: '', slashName: null, atNames: [] }
  const { parseSlash, parseAtMentions } = await import('@/utils/skillParser')
  const slash = parseSlash(text)
  const atNames = parseAtMentions(text)
  const names = new Set<string>()
  if (slash?.name) names.add(slash.name)
  for (const name of atNames) names.add(name)
  if (!workspace || !names.size) return { skillContext: '', slashName: slash?.name || null, atNames }

  const settled = await Promise.allSettled(
    [...names].map(async (name) => {
      try {
        const detail = (await window.api.skills.read(workspace, name)) as SkillDetail
        return detail
      } catch {
        return null
      }
    }),
  )

  const blocks: string[] = []
  let index = 0
  for (const name of names) {
    const result = settled[index++]
    if (result.status !== 'fulfilled' || !result.value || !result.value.content) continue
    const detail = result.value
    const trigger = slash?.name === name ? `/${name}` : `@${name}`
    const truncatedNote = detail.truncated ? '\n（内容已截断，仅展示前 256KB）' : ''
    blocks.push(`技能上下文（${trigger} · ${detail.path}）：\n${detail.content}${truncatedNote}`)
  }

  return { skillContext: blocks.join('\n\n'), slashName: slash?.name || null, atNames }
}
