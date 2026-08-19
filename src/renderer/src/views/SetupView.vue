<script setup lang="ts">
import { useRouter } from 'vue-router'
import SettingsForm from '@/components/SettingsForm.vue'

const router = useRouter()
</script>

<template>
  <main class="setup-page">
    <div class="setup-shell">
      <header class="setup-head">
        <div class="mark">S</div>
        <h1>Super-Agent</h1>
        <p>先连接模型与 GitHub。配置保存后就能开始处理本地代码。</p>
      </header>
      <div class="setup-panel">
        <SettingsForm mode="setup" @saved="router.push('/')" />
      </div>
    </div>
  </main>
</template>

<style scoped>
.setup-page { min-height: 100vh; overflow: auto; overscroll-behavior: contain; display: grid; place-items: center; padding: 48px 24px; background: var(--bg-base); }
.setup-shell { width: min(860px, 100%); min-width: 0; animation: setup-enter 220ms ease-out both; }
.setup-head { margin-bottom: 28px; text-align: center; }
.mark { width: 40px; height: 40px; display: grid; place-items: center; margin: 0 auto 12px; border-radius: 10px; color: white; font-weight: 800; background: var(--accent); }
.setup-head h1 { margin: 0; color: var(--text-primary); font-size: 28px; letter-spacing: -0.5px; }
.setup-head p { margin: 10px 0 0; color: var(--text-secondary); }
.setup-panel { padding: 32px; border: 1px solid var(--glass-border); border-radius: 14px; background: var(--panel-bg); box-shadow: 0 18px 50px rgba(30, 41, 59, 0.08); }
html.dark .setup-panel { box-shadow: 0 18px 50px rgba(0, 0, 0, 0.22); }
@keyframes setup-enter {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}
</style>
