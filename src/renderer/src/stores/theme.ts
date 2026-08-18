import { defineStore } from 'pinia'
import { ref } from 'vue'

export type ThemeMode = 'system' | 'light' | 'dark'

const KEY = 'super-agent-theme'

export const useThemeStore = defineStore('theme', () => {
  const mode = ref<ThemeMode>((localStorage.getItem(KEY) as ThemeMode) || 'system')
  const media = window.matchMedia('(prefers-color-scheme: dark)')

  function resolve(): 'light' | 'dark' {
    if (mode.value === 'system') return media.matches ? 'dark' : 'light'
    return mode.value
  }

  function apply() {
    const t = resolve()
    const el = document.documentElement
    el.setAttribute('data-theme', t)
    el.classList.toggle('dark', t === 'dark')
    localStorage.setItem(KEY, mode.value)
  }

  function set(m: ThemeMode) {
    mode.value = m
    apply()
  }

  // 跟随系统时，系统切换即时生效
  media.addEventListener('change', () => {
    if (mode.value === 'system') apply()
  })

  return { mode, resolve, apply, set }
})
