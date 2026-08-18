import { createRouter, createWebHashHistory } from 'vue-router'
import { useSettingsStore } from '@/stores/settings'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/setup', name: 'setup', component: () => import('@/views/SetupView.vue') },
    { path: '/', name: 'chat', component: () => import('@/views/ChatView.vue') },
    { path: '/settings', name: 'settings', component: () => import('@/views/SettingsView.vue') }
  ]
})

router.beforeEach(async (to) => {
  const settings = useSettingsStore()
  if (!settings.ready) await settings.init()
  if (!settings.configured() && to.name !== 'setup') return { name: 'setup' }
  if (settings.configured() && to.name === 'setup') return { name: 'chat' }
  return true
})

export default router
