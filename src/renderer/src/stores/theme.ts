import { defineStore } from 'pinia'
import { ref } from 'vue'

export type ThemeMode = 'system' | 'light' | 'dark'
export type Density = 'compact' | 'default' | 'comfortable'

const KEY = 'super-agent-theme'
const DENSITY_SCALE: Record<Density, number> = {
  compact: 85,
  default: 100,
  comfortable: 120
}

function clampScale(value: number) {
  return Math.min(130, Math.max(80, Math.round(value)))
}

function densityFromScale(scale: number): Density {
  if (scale <= 90) return 'compact'
  if (scale >= 115) return 'comfortable'
  return 'default'
}

function load() {
  const raw = localStorage.getItem(KEY)
  if (raw === 'system' || raw === 'light' || raw === 'dark') {
    return { mode: raw as ThemeMode, density: 'default' as Density, spacingScale: 100 }
  }
  try {
    const parsed = raw ? JSON.parse(raw) : {}
    const mode: ThemeMode = parsed.mode === 'light' || parsed.mode === 'dark' ? parsed.mode : 'system'
    const parsedDensity: Density | undefined =
      parsed.density === 'compact' || parsed.density === 'comfortable' || parsed.density === 'default'
        ? parsed.density
        : undefined
    const spacingScale = clampScale(Number(parsed.spacingScale) || (parsedDensity ? DENSITY_SCALE[parsedDensity] : 100))
    const density: Density = parsedDensity || densityFromScale(spacingScale)
    return { mode, density, spacingScale }
  } catch {
    return { mode: 'system' as ThemeMode, density: 'default' as Density, spacingScale: 100 }
  }
}

export const useThemeStore = defineStore('theme', () => {
  const saved = load()
  const mode = ref<ThemeMode>(saved.mode)
  const density = ref<Density>(saved.density)
  const spacingScale = ref(saved.spacingScale)
  const media = window.matchMedia('(prefers-color-scheme: dark)')

  function resolve(): 'light' | 'dark' {
    if (mode.value === 'system') return media.matches ? 'dark' : 'light'
    return mode.value
  }

  function persist() {
    localStorage.setItem(KEY, JSON.stringify({
      mode: mode.value,
      density: density.value,
      spacingScale: spacingScale.value
    }))
  }

  function apply() {
    const t = resolve()
    const el = document.documentElement
    el.setAttribute('data-theme', t)
    el.setAttribute('data-density', density.value)
    el.classList.toggle('dark', t === 'dark')
    el.style.setProperty('--ui-space-scale', String(spacingScale.value / 100))
    persist()
  }

  function set(m: ThemeMode) {
    mode.value = m
    apply()
  }

  function setDensity(next: Density) {
    density.value = next
    spacingScale.value = DENSITY_SCALE[next]
    apply()
  }

  function setSpacingScale(next: number) {
    spacingScale.value = clampScale(next)
    density.value = densityFromScale(spacingScale.value)
    apply()
  }

  media.addEventListener('change', () => {
    if (mode.value === 'system') apply()
  })

  return { mode, density, spacingScale, resolve, apply, set, setDensity, setSpacingScale }
})
