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
const modes = [
  { id: 'coding' as const, label: '编码' },
  { id: 'thinking' as const, label: '思考' },
  { id: 'security' as const, label: '安全' }
]

function preset(mode: 'coding' | 'thinking' | 'security') {
  if (!settings.settings.modePresets) settings.settings.modePresets = {}
  if (!settings.settings.modePresets[mode]) settings.settings.modePresets[mode] = {}
  return settings.settings.modePresets[mode]!
}

function capabilities() {
  if (!settings.settings.requestCapabilities) settings.settings.requestCapabilities = {}
  return settings.settings.requestCapabilities
}

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
  <div class="model-page">
    <!-- 供应商状态卡 -->
    <div class="card">
      <div class="card-row provider-head">
        <div class="row-text">
          <strong>自定义供应商 · OpenAI-compatible</strong>
          <span>当前工作台使用的 OpenAI 兼容接口</span>
        </div>
        <span class="badge" :class="{ on: enabled }">{{ enabled ? '已启用' : '未配置' }}</span>
      </div>
    </div>

    <!-- 基础连接 -->
    <div class="card">
      <div class="card-row">
        <div class="row-text"><strong>Base URL</strong><span>兼容 OpenAI /chat/completions 的服务地址</span></div>
        <el-input v-model="apiBaseUrl" placeholder="http://127.0.0.1:3000/v1" style="max-width:320px" />
      </div>
      <div class="card-row">
        <div class="row-text"><strong>API 格式</strong><span>固定为 Chat Completions</span></div>
        <el-input :model-value="'Chat Completions (/chat/completions)'" disabled style="max-width:320px" />
      </div>
      <div class="card-row">
        <div class="row-text"><strong>API Key</strong><span>仅本地加密存储，不上传</span></div>
        <el-input v-model="apiKey" type="password" show-password :placeholder="settings.hasAiKey ? '已保存 ·••••••••，留空则保留当前值' : '输入 API Key'" style="max-width:320px" />
      </div>
    </div>

    <!-- 请求能力 -->
    <div class="card">
      <div class="card-row">
        <div class="row-text"><strong>请求能力</strong><span>仅在兼容接口明确支持时启用，未启用字段不会发送</span></div>
        <div class="switch-group">
          <span class="switch-item"><el-switch v-model="capabilities().temperature" /> 发送 temperature</span>
          <span class="switch-item"><el-switch v-model="capabilities().reasoningEffort" /> 发送 reasoning_effort</span>
        </div>
      </div>
    </div>

    <!-- 模式预设 -->
    <div class="card">
      <div class="card-head">模式预设 <span>按编码/思考/安全自动选用模型与推理强度</span></div>
      <div class="preset-list">
        <div v-for="item in modes" :key="item.id" class="preset-row">
          <strong class="preset-label">{{ item.label }}</strong>
          <el-select v-model="preset(item.id).model" clearable placeholder="使用全局模型" size="small">
            <el-option v-for="name in models" :key="name" :label="name" :value="name" />
          </el-select>
          <el-input-number v-model="preset(item.id).temperature" :min="0" :max="2" :step="0.1" :precision="1" controls-position="right" size="small" placeholder="温度" />
          <el-select v-model="preset(item.id).reasoningEffort" clearable size="small" :disabled="!settings.settings.requestCapabilities?.reasoningEffort" placeholder="思考等级">
            <el-option label="低" value="low" />
            <el-option label="中" value="medium" />
            <el-option label="高" value="high" />
            <el-option label="极高" value="xhigh" />
          </el-select>
        </div>
      </div>
    </div>

    <!-- 模型列表 -->
    <div class="card">
      <div class="card-head">模型列表 <span>点击选用，星标为当前</span> <el-button size="small" round @click="addingModel = !addingModel">{{ addingModel ? '取消' : '+ 添加模型' }}</el-button></div>
      <div v-if="addingModel" class="card-row">
        <el-input v-model="newModel" placeholder="模型 ID，如 gpt-4o / deepseek-chat" style="flex:1" @keydown.enter.prevent="addModel" />
        <el-button size="small" @click="addingModel = false">取消</el-button>
        <el-button type="primary" size="small" @click="addModel">添加</el-button>
      </div>
      <div v-for="item in models" :key="item" class="card-row model-item" :class="{ active: model === item }" @click="useModel(item)">
        <span class="model-name">{{ item }}</span>
        <span v-if="model === item" class="model-current">当前</span>
        <button v-if="models.length > 1" class="icon-btn" type="button" title="移除" @click.stop="removeModel(item)"><Icon icon="mdi:trash-can-outline" width="15" /></button>
      </div>
      <div v-if="!models.length" class="card-row"><div class="row-text"><span>暂无模型，请添加</span></div></div>
    </div>

    <div class="actions">
      <el-button :loading="testing" @click="test">测试连接</el-button>
      <el-button type="primary" :loading="saving" @click="save">保存设置</el-button>
    </div>
  </div>
</template>

<style scoped>
.model-page { display: flex; flex-direction: column; gap: 16px; }
.card {
  border: 1px solid #e6eef3; border-radius: 10px; background: #fff; overflow: hidden;
}
.card-head {
  display: flex; align-items: center; justify-content: space-between; gap: 12px;
  padding: 12px 16px; border-bottom: 1px solid #f1f5f9; font-size: 13px; font-weight: 600; color: #0f172a;
}
.card-head span { font-weight: 400; color: #64748b; font-size: 12px; }
.card-row {
  display: flex; align-items: center; justify-content: space-between; gap: 16px;
  padding: 14px 16px; border-top: 1px solid #f1f5f9;
}
.card-row:first-child { border-top: 0; }
.provider-head { background: #f8fafc; }
.row-text { display: flex; flex-direction: column; gap: 4px; max-width: 520px; }
.row-text strong { font-size: 13px; font-weight: 600; color: #0f172a; }
.row-text span { font-size: 12px; color: #64748b; line-height: 1.5; }
.badge { padding: 4px 10px; border-radius: 999px; background: #f1f5f9; color: #64748b; font-size: 12px; border: 1px solid #e2e8f0; }
.badge.on { color: #15803d; background: #dcfce7; border-color: #bbf7d0; }
.switch-group { display: flex; gap: 16px; flex-wrap: wrap; }
.switch-item { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; color: #334155; }
.preset-list { padding: 12px 16px; display: grid; gap: 8px; }
.preset-row {
  display: grid; grid-template-columns: 48px minmax(0,1fr) 110px 130px; gap: 8px; align-items: center;
  padding: 8px; border: 1px solid #eef2f6; border-radius: 8px; background: #f8fafc;
}
.preset-label { font-size: 12px; font-weight: 600; color: #0f172a; }
.model-item { cursor: pointer; }
.model-item:hover { background: #f8fafc; }
.model-item.active { background: #eff6ff; border-color: #dbeafe; }
.model-name { font-size: 13px; color: #0f172a; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.model-current { margin-left: auto; font-size: 12px; color: #2563eb; }
.icon-btn { display: grid; place-items: center; width: 24px; height: 24px; border: 0; background: transparent; color: #94a3b8; cursor: pointer; border-radius: 6px; }
.icon-btn:hover { background: #fee2e2; color: #dc2626; }
.actions { display: flex; justify-content: flex-end; gap: 10px; padding: 4px 0; }
@media (max-width: 720px) {
  .preset-row { grid-template-columns: 1fr 1fr; }
  .preset-row .preset-label { grid-column: 1 / -1; }
}
</style>
