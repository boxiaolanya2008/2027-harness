import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { Settings } from '@/types'

const STORAGE_KEY = 'super-agent-settings'

function load(): Settings {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
  } catch {
    return {} as Settings
  }
}

export const useSettingsStore = defineStore('settings', () => {
  const settings = ref<Settings>({
    apiBaseUrl: load().apiBaseUrl || 'https://api.openai.com/v1',
    model: load().model || ''
  })
  const hasAiKey = ref(false)
  const hasGithubToken = ref(false)
  const gitIdentity = ref<{ name: string; email: string }>({ name: '', email: '' })
  const ready = ref(false)
  const error = ref('')
  let initializing: Promise<void> | null = null

  async function init() {
    if (ready.value) return
    if (initializing) return initializing
    initializing = Promise.all([window.api.settings.get(), window.api.git.identity()]).then(([status, identity]) => {
      hasAiKey.value = status.hasAiKey
      hasGithubToken.value = status.hasGithubToken
      gitIdentity.value = identity
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
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ apiBaseUrl: settings.value.apiBaseUrl, model: settings.value.model })
    )
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
    ready,
    error,
    init,
    refreshGitIdentity,
    persist,
    setAiKey,
    setGithubToken,
    configured
  }
})
