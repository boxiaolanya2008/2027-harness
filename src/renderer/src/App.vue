<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import NProgress from 'nprogress'
import { useSettingsStore } from '@/stores/settings'
import { useThemeStore } from '@/stores/theme'
import { useChatStore } from '@/stores/chat'

const router = useRouter()
const settings = useSettingsStore()
const theme = useThemeStore()
const chat = useChatStore()

onMounted(async () => {
  theme.apply()
  await settings.init()
  await chat.hydrate()
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
