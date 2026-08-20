<script setup lang="ts">
import { onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import NProgress from 'nprogress'
import { useSettingsStore } from '@/stores/settings'
import { useThemeStore } from '@/stores/theme'
import { useChatStore } from '@/stores/chat'

const router = useRouter()
const settings = useSettingsStore()
const theme = useThemeStore()
const chat = useChatStore()

function handleShortcuts(e: KeyboardEvent) {
  try {
    const map: Record<string,string> = JSON.parse(localStorage.getItem('codex_shortcuts') || '{}')
    const key = `${e.ctrlKey ? 'Ctrl+' : ''}${e.metaKey ? 'Cmd+' : ''}${e.shiftKey ? 'Shift+' : ''}${e.key}`
    // normalize
    const norm = (s: string) => s.replace('Control', 'Ctrl').replace('Meta', 'Cmd')
    for (const [action, shortcut] of Object.entries(map)) {
      if (norm(shortcut) === key || norm(shortcut).toLowerCase() === key.toLowerCase()) {
        if (action === '新建任务') { e.preventDefault(); chat.newConversation() }
        if (action === '停止' && e.key === 'Escape') { chat.stop() }
      }
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n') { e.preventDefault(); chat.newConversation() }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f' && location.hash.includes('settings')) {
      const el = document.querySelector<HTMLInputElement>('.search-wrap input')
      if (el) { e.preventDefault(); el.focus() }
    }
  } catch {}
}

onMounted(async () => {
  theme.apply()
  await settings.init()
  await chat.hydrate()
  window.addEventListener('keydown', handleShortcuts)
  // voice autoplay for assistant messages
  watch(() => chat.current()?.messages.slice(-1)[0], (msg) => {
    try {
      if (!msg || msg.role !== 'assistant' || !msg.content) return
      if (localStorage.getItem('codex_voice_autoplay') !== 'true') return
      const utter = new SpeechSynthesisUtterance(String(msg.content).slice(0, 400))
      utter.lang = 'zh-CN'
      speechSynthesis.speak(utter)
    } catch {}
  })
})

router.beforeEach(() => {
  NProgress.start()
})
router.afterEach(() => {
  NProgress.done()
})
</script>

<template>
  <router-view v-slot="{ Component }">
    <transition name="fade" mode="out-in">
      <component :is="Component" />
    </transition>
  </router-view>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.18s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
