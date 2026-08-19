<script setup lang="ts">
import { useRouter } from 'vue-router'
import { Icon } from '@iconify/vue'
import SettingsForm from '@/components/SettingsForm.vue'

const router = useRouter()
</script>

<template>
  <main class="settings-page">
    <header class="settings-topbar">
      <button class="back" @click="router.push('/')">
        <Icon icon="mdi:arrow-left" width="18" />
        <span>返回工作台</span>
      </button>
      <div class="brand">Super-Agent</div>
    </header>

    <div class="settings-body">
      <aside class="settings-nav">
        <div class="nav-title">设置</div>
        <a href="#appearance">外观</a>
        <a href="#provider">AI Provider</a>
        <a href="#github">GitHub</a>
      </aside>
      <section class="settings-content">
        <header class="page-title">
          <h1>应用设置</h1>
          <p>配置模型连接、GitHub 和界面偏好。密钥只保存在本机安全存储中。</p>
        </header>
        <SettingsForm mode="settings" />
      </section>
    </div>
  </main>
</template>

<style scoped>
.settings-page { height: 100vh; min-height: 0; overflow: auto; overscroll-behavior: contain; color: var(--text-primary); background: var(--bg-base); }
.settings-topbar { height: 54px; display: flex; align-items: center; gap: 18px; padding: 0 22px; border-bottom: 1px solid var(--glass-border); background: var(--panel-bg); }
.back { display: inline-flex; align-items: center; gap: 7px; border: 0; background: transparent; color: var(--text-secondary); cursor: pointer; font-size: 13px; transition: color 160ms ease, transform 160ms ease; }
.back:hover { color: var(--text-primary); }
.back:active { transform: translateX(-2px); }
.brand { font-size: 14px; font-weight: 700; }
.settings-body { display: grid; grid-template-columns: 210px minmax(0, 760px); justify-content: center; min-width: 0; min-height: calc(100vh - 54px); }
.settings-nav { min-width: 0; padding: 36px 22px; border-right: 1px solid var(--glass-border); color: var(--text-secondary); }
.nav-title { margin-bottom: 16px; color: var(--text-primary); font-weight: 700; }
.settings-nav a { display: block; padding: 8px 0; color: inherit; text-decoration: none; font-size: 13px; }
.settings-nav a:hover { color: var(--accent); }
.settings-content { padding: 42px 48px 64px; min-width: 0; }
.page-title { margin-bottom: 36px; }
.page-title h1 { margin: 0 0 10px; font-size: 26px; letter-spacing: -0.4px; }
.page-title p { margin: 0; color: var(--text-secondary); line-height: 1.7; }
@media (max-width: 760px) { .settings-body { display: block; } .settings-nav { display: none; } .settings-content { padding: 28px 20px 48px; } }
</style>
