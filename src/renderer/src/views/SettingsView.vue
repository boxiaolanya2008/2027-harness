<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { Icon } from '@iconify/vue'
import AppearanceSettings from '@/components/settings/AppearanceSettings.vue'
import ModelSettings from '@/components/settings/ModelSettings.vue'
import GithubSettings from '@/components/settings/GithubSettings.vue'

type Section = 'appearance' | 'model' | 'github'

const router = useRouter()
const section = ref<Section>('appearance')
const groups = [
  {
    caption: '基础设置',
    items: [
      { id: 'appearance' as const, icon: 'mdi:palette-outline', label: '外观' },
      { id: 'model' as const, icon: 'mdi:tune-variant', label: '模型设置' },
      { id: 'github' as const, icon: 'mdi:github', label: 'GitHub' }
    ]
  }
]
const titles: Record<Section, { title: string; desc: string }> = {
  appearance: { title: '外观', desc: '调整工作台的主题、密度和显示间距。' },
  model: { title: '模型设置', desc: '管理自定义模型供应商，配置后可在聊天中使用。' },
  github: { title: 'GitHub', desc: '管理 GitHub 连接和本地 Git 身份。' }
}
const current = computed(() => titles[section.value])
</script>

<template>
  <main class="settings-page">
    <header class="settings-topbar">
      <button class="back" type="button" @click="router.push('/')">
        <Icon icon="mdi:arrow-left" width="18" /> 返回工作区
      </button>
      <strong>Super-Agent</strong>
    </header>
    <div class="settings-layout">
      <aside class="settings-nav">
        <div v-for="group in groups" :key="group.caption" class="nav-group">
          <div class="nav-caption">{{ group.caption }}</div>
          <button
            v-for="item in group.items"
            :key="item.id"
            type="button"
            :class="{ active: section === item.id }"
            @click="section = item.id"
          >
            <Icon :icon="item.icon" width="17" />
            {{ item.label }}
          </button>
        </div>
      </aside>
      <section class="settings-content">
        <header class="page-title">
          <h1>{{ current.title }}</h1>
          <p>{{ current.desc }}</p>
        </header>
        <AppearanceSettings v-if="section === 'appearance'" />
        <ModelSettings v-else-if="section === 'model'" />
        <GithubSettings v-else />
      </section>
    </div>
  </main>
</template>

<style scoped>
.settings-page { height: 100vh; min-height: 0; overflow: hidden; color: var(--text-primary); background: var(--workbench-bg); }
.settings-topbar { height: 52px; display: flex; align-items: center; gap: 18px; padding: 0 22px; border-bottom: 1px solid var(--glass-border); background: var(--panel-bg); }
.back { display: inline-flex; align-items: center; gap: 7px; border: 0; background: transparent; color: var(--text-secondary); cursor: pointer; }
.back:hover { color: var(--text-primary); }
.settings-layout { display: grid; grid-template-columns: 236px minmax(0, 1fr); height: calc(100% - 52px); min-height: 0; }
.settings-nav { display: flex; flex-direction: column; gap: 22px; padding: 22px 12px; border-right: 1px solid var(--glass-border); background: var(--panel-bg); overflow: auto; }
.nav-group { display: flex; flex-direction: column; gap: 3px; }
.nav-caption { padding: 0 10px 8px; color: var(--text-faint); font-size: 11px; font-weight: 700; letter-spacing: 0.04em; }
.settings-nav button { display: flex; align-items: center; gap: 9px; width: 100%; padding: 9px 10px; border: 0; border-radius: 8px; color: var(--text-secondary); background: transparent; text-align: left; cursor: pointer; }
.settings-nav button:hover { color: var(--text-primary); background: var(--hover-bg); }
.settings-nav button.active { color: var(--text-primary); background: var(--selected-bg); }
.settings-content { min-width: 0; overflow: auto; padding: 36px 48px 64px; background: var(--workbench-bg); }
.page-title { margin-bottom: 22px; }
.page-title h1 { margin: 0 0 8px; font-size: 26px; font-weight: 700; }
.page-title p { margin: 0; color: var(--text-secondary); font-size: 13px; }
@media (max-width: 760px) {
  .settings-layout { grid-template-columns: 1fr; height: auto; overflow: auto; }
  .settings-nav { flex-direction: row; flex-wrap: wrap; gap: 8px; padding: 10px; border-right: 0; border-bottom: 1px solid var(--glass-border); }
  .nav-caption { display: none; }
  .settings-nav button { width: auto; }
  .settings-content { padding: 24px 16px 48px; }
}
</style>
