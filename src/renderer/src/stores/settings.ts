import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { ApprovalMode, ComposerMode, ModeModelPreset, ReasoningEffort, RequestCapabilities, Settings } from '@/types'

const STORAGE_KEY = 'super-agent-settings'

function validReasoningEffort(value: unknown): value is ReasoningEffort {
  return value === 'low' || value === 'medium' || value === 'high' || value === 'xhigh'
}

function normalizePreset(value: unknown): ModeModelPreset {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  const raw = value as Record<string, unknown>
  const temperature = typeof raw.temperature === 'number' && Number.isFinite(raw.temperature) && raw.temperature >= 0 && raw.temperature <= 2
    ? raw.temperature
    : undefined
  return {
    ...(typeof raw.model === 'string' && raw.model.trim() ? { model: raw.model.trim() } : {}),
    ...(temperature !== undefined ? { temperature } : {}),
    ...(validReasoningEffort(raw.reasoningEffort) ? { reasoningEffort: raw.reasoningEffort } : {})
  }
}

function normalizeCapabilities(value: unknown): RequestCapabilities {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  const raw = value as Record<string, unknown>
  return {
    ...(typeof raw.temperature === 'boolean' ? { temperature: raw.temperature } : {}),
    ...(typeof raw.reasoningEffort === 'boolean' ? { reasoningEffort: raw.reasoningEffort } : {})
  }
}

function normalizeApprovalMode(value: unknown): ApprovalMode | undefined {
  if (value === 'request' || value === 'help' || value === 'full') return value
  return undefined
}

function load(): Settings {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') as Record<string, unknown>
    const modePresets = raw.modePresets && typeof raw.modePresets === 'object' ? raw.modePresets as Record<string, unknown> : {}
    return {
      apiBaseUrl: typeof raw.apiBaseUrl === 'string' ? raw.apiBaseUrl : '',
      model: typeof raw.model === 'string' ? raw.model : '',
      models: Array.isArray(raw.models) ? raw.models.filter((item): item is string => typeof item === 'string') : [],
      modePresets: {
        coding: normalizePreset(modePresets.coding),
        thinking: normalizePreset(modePresets.thinking),
        security: normalizePreset(modePresets.security)
      },
      requestCapabilities: normalizeCapabilities(raw.requestCapabilities),
      approvalMode: normalizeApprovalMode(raw.approvalMode)
    }
  } catch {
    return {} as Settings
  }
}

export const useSettingsStore = defineStore('settings', () => {
  const saved = load()
  const fallbackModel = saved.model || ''
  const savedPresets = saved.modePresets || {}
  const settings = ref<Settings>({
    apiBaseUrl: saved.apiBaseUrl || 'https://api.openai.com/v1',
    model: fallbackModel,
    models: saved.models?.length ? saved.models : (fallbackModel ? [fallbackModel] : []),
    modePresets: {
      coding: { model: fallbackModel || undefined, temperature: 0.2, reasoningEffort: 'medium', ...savedPresets.coding },
      thinking: { model: fallbackModel || undefined, temperature: 0.4, reasoningEffort: 'high', ...savedPresets.thinking },
      security: { model: fallbackModel || undefined, temperature: 0.3, reasoningEffort: 'high', ...savedPresets.security }
    },
    requestCapabilities: { temperature: true, reasoningEffort: true, ...saved.requestCapabilities },
    approvalMode: saved.approvalMode || 'help'
  })
  const hasAiKey = ref(false)
  const hasGithubToken = ref(false)
  const gitIdentity = ref<{ name: string; email: string }>({ name: '', email: '' })
  const githubLogin = ref('')
  const githubAuthNote = ref('')
  const ready = ref(false)
  const error = ref('')
  let initializing: Promise<void> | null = null

  async function init() {
    if (ready.value) return
    if (initializing) return initializing
    initializing = Promise.all([window.api.settings.get(), window.api.git.identity(), window.api.githubAuth.detectLocal()]).then(([status, identity, githubAuth]) => {
      hasAiKey.value = status.hasAiKey
      hasGithubToken.value = status.hasGithubToken || githubAuth.connected
      gitIdentity.value = identity
      githubLogin.value = githubAuth.login
      githubAuthNote.value = githubAuth.connected ? (githubAuth.imported ? '已从本机 GitHub CLI 登录导入' : '已连接 GitHub') : (githubAuth.reason || '')
    }).catch((reason) => {
      error.value = reason?.message || String(reason)
    }).finally(() => {
      ready.value = true
      initializing = null
    })
    return initializing
  }

  async function refreshGitIdentity() {
    gitIdentity.value = await window.api.git.identity()
  }

  function persist() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      apiBaseUrl: settings.value.apiBaseUrl,
      model: settings.value.model,
      models: settings.value.models || [],
      modePresets: settings.value.modePresets || {},
      requestCapabilities: settings.value.requestCapabilities || {},
      approvalMode: settings.value.approvalMode || 'help'
    }))
  }

  function setApprovalMode(mode: ApprovalMode) {
    settings.value.approvalMode = mode
    persist()
  }

  function presetFor(mode: ComposerMode): ModeModelPreset {
    return settings.value.modePresets?.[mode] || {}
  }

  async function setAiKey(key: string) {
    await window.api.settings.setAiKey(key)
    hasAiKey.value = !!key
  }

  async function setGithubToken(token: string) {
    await window.api.settings.setGithubToken(token)
    hasGithubToken.value = !!token
  }

  const configured = () => hasAiKey.value && !!settings.value.model

  return {
    settings,
    hasAiKey,
    hasGithubToken,
    gitIdentity,
    githubLogin,
    githubAuthNote,
    ready,
    error,
    init,
    refreshGitIdentity,
    persist,
    setAiKey,
    setGithubToken,
    presetFor,
    setApprovalMode,
    configured
  }
})
