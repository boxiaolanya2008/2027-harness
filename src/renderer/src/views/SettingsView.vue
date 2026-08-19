<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { Icon } from '@iconify/vue'
import AppearanceSettings from '@/components/settings/AppearanceSettings.vue'
import ModelSettings from '@/components/settings/ModelSettings.vue'
import GithubSettings from '@/components/settings/GithubSettings.vue'

const router = useRouter()
const section = ref<'appearance' | 'model' | 'github'>('appearance')
</script>
<template>
  <main class="settings-page">
    <header class="settings-topbar"><button class="back" @click="router.push('/')"><Icon icon="mdi:arrow-left" width="18" /> 返回工作区</button><strong>Super-Agent</strong></header>
    <div class="settings-layout">
      <aside class="settings-nav">
        <div class="nav-caption">设置</div>
        <button :class="{ active: section === 'appearance' }" @click="section = 'appearance'"><Icon icon="mdi:palette-outline" width="17" /> 外观</button>
        <button :class="{ active: section === 'model' }" @click="section = 'model'"><Icon icon="mdi:tune-variant" width="17" /> 模型设置</button>
        <button :class="{ active: section === 'github' }" @click="section = 'github'"><Icon icon="mdi:github" width="17" /> GitHub</button>
      </aside>
      <section class="settings-content">
        <header class="page-title"><h1>{{ section === 'appearance' ? '外观' : section === 'model' ? '模型设置' : 'GitHub' }}</h1><p>{{ section === 'model' ? '管理自定义模型供应商，配置后可在聊天中使用。' : section === 'github' ? '管理 GitHub 连接和本地 Git 身份。' : '调整工作台的主题和显示方式。' }}</p></header>
        <AppearanceSettings v-if="section === 'appearance'" />
        <ModelSettings v-else-if="section === 'model'" />
        <GithubSettings v-else />
      </section>
    </div>
  </main>
</template>
<style scoped>
.settings-page { height: 100%; min-height: 0; overflow: auto; color: var(--text-primary); background: var(--bg-base); }
.settings-topbar { height: 54px; display: flex; align-items: center; gap: 22px; padding: 0 24px; border-bottom: 1px solid var(--glass-border); background: var(--panel-bg); }
.back { display: inline-flex; align-items: center; gap: 7px; border: 0; background: transparent; color: var(--text-secondary); cursor: pointer; } .back:hover { color: var(--text-primary); }
.settings-layout { display: grid; grid-template-columns: 230px minmax(0, 860px); justify-content: center; min-height: calc(100% - 54px); }
.settings-nav { display: flex; flex-direction: column; gap: 3px; padding: 38px 14px; border-right: 1px solid var(--glass-border); background: var(--panel-bg); }
.nav-caption { padding: 0 10px 14px; color: var(--text-faint); font-size: 12px; font-weight: 700; } .settings-nav button { display: flex; align-items: center; gap: 9px; padding: 10px; border: 0; border-radius: 8px; color: var(--text-secondary); background: transparent; text-align: left; cursor: pointer; } .settings-nav button:hover, .settings-nav button.active { color: var(--text-primary); background: var(--selected-bg); }
.settings-content { min-width: 0; padding: 48px; } .page-title { margin-bottom: 28px; } .page-title h1 { margin: 0 0 9px; font-size: 28px; } .page-title p { margin: 0; color: var(--text-secondary); }
@media (max-width: 760px) { .settings-layout { display: block; } .settings-nav { flex-direction: row; overflow: auto; padding: 10px; border-right: 0; border-bottom: 1px solid var(--glass-border); } .nav-caption { display: none; } .settings-content { padding: 28px 18px 48px; } }
</style>
