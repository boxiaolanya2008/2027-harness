<script setup lang="ts">
import { computed, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { Icon } from '@iconify/vue'
import { useSettingsStore } from '@/stores/settings'

const settings = useSettingsStore()
const apiBaseUrl = ref(settings.settings.apiBaseUrl)
const model = ref(settings.settings.model)
const apiKey = ref('')
const testing = ref(false)
const saving = ref(false)
const addingModel = ref(false)
const newModel = ref('')

const models = computed(() => {
  const list = Array.isArray(settings.settings.models) ? settings.settings.models.filter(Boolean) : []
  if (model.value && !list.includes(model.value)) return [model.value, ...list]
  return list
})
const enabled = computed(() => settings.hasAiKey && Boolean(settings.settings.model))

function useModel(name: string) {
  model.value = name
}

function addModel() {
  const name = newModel.value.trim()
  if (!name) return
  const next = Array.from(new Set([...(settings.settings.models || []), name]))
  settings.settings.models = next
  if (!model.value) model.value = name
  newModel.value = ''
  addingModel.value = false
  settings.persist()
}

function removeModel(name: string) {
  settings.settings.models = (settings.settings.models || []).filter((item) => item !== name)
  if (model.value === name) model.value = settings.settings.models[0] || ''
  settings.persist()
}

async function test() {
  const key = apiKey.value || (await window.api.settings.getAiKeyForRequest())
  if (!key || !model.value) return ElMessage.warning('请先填写模型和 API Key')
  testing.value = true
  try {
    const response = await fetch(`${apiBaseUrl.value.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({ model: model.value, messages: [{ role: 'user', content: 'ping' }], max_tokens: 5 })
    })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    ElMessage.success('连接成功')
  } catch (error: any) {
    ElMessage.error(`连接失败：${error.message}`)
  } finally {
    testing.value = false
  }
}

async function save() {
  if (!model.value || (!apiKey.value && !settings.hasAiKey)) return ElMessage.warning('模型和 API Key 必填')
  saving.value = true
  try {
    settings.settings.apiBaseUrl = apiBaseUrl.value.trim()
    settings.settings.model = model.value.trim()
    if (!settings.settings.models?.includes(model.value)) {
      settings.settings.models = [...(settings.settings.models || []), model.value]
    }
    settings.persist()
    if (apiKey.value) await settings.setAiKey(apiKey.value)
    apiKey.value = ''
    ElMessage.success('模型设置已保存')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <section class="model-settings">
    <aside class="provider-list">
      <div class="provider-title">自定义供应商</div>
      <button class="provider active" type="button">
        <span class="provider-dot" :class="{ ready: enabled }" />
        OpenAI-compatible
      </button>
    </aside>
    <div class="provider-detail">
      <header class="detail-head">
        <div>
          <h2>OpenAI-compatible</h2>
          <p>当前工作台使用的 OpenAI 兼容接口。</p>
        </div>
        <span class="badge" :class="{ on: enabled }">{{ enabled ? '已启用' : '未配置' }}</span>
      </header>
      <el-form label-position="top">
        <el-form-item label="Base URL">
          <el-input v-model="apiBaseUrl" placeholder="http://127.0.0.1:3000/v1" />
        </el-form-item>
        <el-form-item label="API 格式">
          <el-input :model-value="'Chat Completions (/chat/completions)'" disabled />
        </el-form-item>
        <el-form-item label="API Key">
          <el-input v-model="apiKey" type="password" show-password :placeholder="settings.hasAiKey ? '已保存 ·••••••••，留空则保留当前值' : '输入 API Key'" />
        </el-form-item>
        <el-form-item label="模型列表">
          <div class="model-list">
            <div v-for="item in models" :key="item" class="model-row" :class="{ active: model === item }">
              <button type="button" @click="useModel(item)">{{ item }}</button>
              <span v-if="model === item" class="current">当前</span>
              <button v-if="models.length > 1" class="icon-btn" type="button" title="移除" @click="removeModel(item)">
                <Icon icon="mdi:trash-can-outline" width="15" />
              </button>
            </div>
            <div v-if="addingModel" class="add-row">
              <el-input v-model="newModel" placeholder="模型 ID" @keydown.enter.prevent="addModel" />
              <el-button size="small" @click="addingModel = false">取消</el-button>
              <el-button type="primary" size="small" @click="addModel">添加</el-button>
            </div>
            <button v-else class="add-model" type="button" @click="addingModel = true">+ 添加模型</button>
          </div>
        </el-form-item>
      </el-form>
      <div class="actions">
        <el-button :loading="testing" @click="test">测试连接</el-button>
        <el-button type="primary" :loading="saving" @click="save">保存设置</el-button>
      </div>
    </div>
  </section>
</template>

<style scoped>
.model-settings { display: grid; grid-template-columns: 220px minmax(0, 1fr); min-height: 520px; border: 1px solid var(--glass-border); border-radius: 12px; overflow: hidden; background: var(--surface-bg); }
.provider-list { padding: 18px 12px; border-right: 1px solid var(--glass-border); background: var(--panel-bg); }
.provider-title { padding: 0 10px 10px; color: var(--text-faint); font-size: 12px; font-weight: 700; }
.provider { display: flex; align-items: center; gap: 9px; width: 100%; padding: 10px; border: 1px solid transparent; border-radius: 8px; color: var(--text-primary); background: var(--surface-bg); text-align: left; cursor: default; }
.provider-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--text-faint); }
.provider-dot.ready { background: #27a65a; }
.provider-detail { padding: 24px 28px 28px; }
.detail-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 22px; }
h2 { margin: 0 0 6px; font-size: 18px; }
p { margin: 0; color: var(--text-secondary); font-size: 13px; }
.badge { padding: 3px 8px; border-radius: 999px; color: var(--text-faint); background: var(--panel-bg); font-size: 12px; }
.badge.on { color: #17803d; background: rgba(39, 166, 90, 0.12); }
.model-list { display: flex; flex-direction: column; gap: 6px; width: 100%; }
.model-row { display: flex; align-items: center; gap: 8px; padding: 8px 10px; border: 1px solid var(--glass-border); border-radius: 8px; }
.model-row.active { border-color: var(--accent); background: color-mix(in srgb, var(--accent) 8%, var(--surface-bg)); }
.model-row button { border: 0; background: transparent; color: var(--text-primary); cursor: pointer; }
.current { margin-left: auto; color: var(--accent); font-size: 12px; }
.icon-btn { display: grid; place-items: center; width: 24px; height: 24px; margin-left: auto; color: var(--text-faint); }
.icon-btn:hover { color: var(--diff-remove); }
.add-model { width: fit-content; padding: 6px 2px; border: 0; background: transparent; color: var(--accent); cursor: pointer; }
.add-row { display: flex; gap: 8px; align-items: center; }
.actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 8px; }
@media (max-width: 680px) {
  .model-settings { grid-template-columns: 1fr; }
  .provider-list { border-right: 0; border-bottom: 1px solid var(--glass-border); }
}
</style>
