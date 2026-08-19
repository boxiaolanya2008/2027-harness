<script setup lang="ts">
import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import { useSettingsStore } from '@/stores/settings'

const settings = useSettingsStore()
const apiBaseUrl = ref(settings.settings.apiBaseUrl)
const model = ref(settings.settings.model)
const apiKey = ref('')
const testing = ref(false)
const saving = ref(false)

async function test() {
  const key = apiKey.value || (await window.api.settings.getAiKeyForRequest())
  if (!key || !model.value) return ElMessage.warning('请先填写模型和 API Key')
  testing.value = true
  try {
    const response = await fetch(`${apiBaseUrl.value.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({ model: model.value, messages: [{ role: 'user', content: 'ping' }], max_tokens: 5 })
    })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    ElMessage.success('连接成功')
  } catch (error: any) { ElMessage.error(`连接失败：${error.message}`) } finally { testing.value = false }
}

async function save() {
  if (!model.value || (!apiKey.value && !settings.hasAiKey)) return ElMessage.warning('模型和 API Key 必填')
  saving.value = true
  try {
    settings.settings.apiBaseUrl = apiBaseUrl.value.trim()
    settings.settings.model = model.value.trim()
    settings.persist()
    if (apiKey.value) await settings.setAiKey(apiKey.value)
    apiKey.value = ''
    ElMessage.success('模型设置已保存')
  } finally { saving.value = false }
}
</script>
<template>
  <section class="model-settings">
    <aside class="provider-list">
      <div class="provider-title">已配置 Provider</div>
      <button class="provider active"><span class="provider-dot" :class="{ ready: settings.hasAiKey && settings.settings.model }" />OpenAI-compatible</button>
    </aside>
    <div class="provider-detail">
      <header><h2>模型设置</h2><p>管理当前真实的 OpenAI-compatible 模型连接。</p></header>
      <el-form label-position="top">
        <el-form-item label="API Base URL"><el-input v-model="apiBaseUrl" placeholder="http://127.0.0.1:3000/v1" /></el-form-item>
        <el-form-item label="Model"><el-input v-model="model" placeholder="输入实际模型名称" /></el-form-item>
        <el-form-item label="API Key">
          <el-input v-model="apiKey" type="password" show-password :placeholder="settings.hasAiKey ? '已保存 ·••••••••，留空则保留当前值' : '输入 API Key'" />
          <small v-if="settings.hasAiKey && !apiKey">已保存 ·••••••••</small>
        </el-form-item>
      </el-form>
      <div class="actions"><el-button :loading="testing" @click="test">测试连接</el-button><el-button type="primary" :loading="saving" @click="save">保存设置</el-button></div>
    </div>
  </section>
</template>
<style scoped>
.model-settings { display: grid; grid-template-columns: 230px minmax(0, 1fr); min-height: 460px; border: 1px solid var(--glass-border); border-radius: 12px; overflow: hidden; background: var(--surface-bg); }
.provider-list { padding: 20px 12px; border-right: 1px solid var(--glass-border); background: var(--panel-bg); }
.provider-title { padding: 0 10px 12px; color: var(--text-faint); font-size: 12px; font-weight: 700; }
.provider { display: flex; align-items: center; gap: 9px; width: 100%; padding: 10px; border: 1px solid transparent; border-radius: 8px; color: var(--text-primary); background: transparent; text-align: left; cursor: pointer; }
.provider.active { border-color: var(--glass-border); background: var(--surface-bg); }
.provider-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--text-faint); } .provider-dot.ready { background: #27a65a; }
.provider-detail { padding: 28px; } .provider-detail header { margin-bottom: 22px; } h2 { margin: 0 0 7px; font-size: 20px; } p { margin: 0; color: var(--text-secondary); font-size: 13px; } small { color: var(--text-secondary); }
.actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 18px; }
@media (max-width: 680px) { .model-settings { grid-template-columns: 1fr; } .provider-list { border-right: 0; border-bottom: 1px solid var(--glass-border); } }
</style>
