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
  const ready = ref(false)

  async function init() {
    const s = await window.api.settings.get()
    hasAiKey.value = !!s.aiKey
    hasGithubToken.value = !!s.githubToken
    ready.value = true
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

  return { settings, hasAiKey, hasGithubToken, ready, init, persist, setAiKey, setGithubToken, configured }
})
