<script setup lang="ts">
import { computed, ref } from 'vue'
import { Icon } from '@iconify/vue'
import { useSettingsStore } from '@/stores/settings'
import type { ComposerAttachment, ComposerMode, ReasoningEffort } from '@/types'

const props = defineProps<{
  modelValue: string
  running: boolean
  workspaceName: string
  model: string
  hasGithub: boolean
  attachments?: ComposerAttachment[]
}>()
const emit = defineEmits<{
  (event: 'update:modelValue', value: string): void
  (event: 'submit', payload: { attachments: ComposerAttachment[]; mode: ComposerMode }): void
  (event: 'stop'): void
  (event: 'update:attachments', value: ComposerAttachment[]): void
}>()

const settings = useSettingsStore()
const value = computed({
  get: () => props.modelValue,
  set: (next) => emit('update:modelValue', next)
})
const modelOptions = computed(() => settings.settings.models?.length ? settings.settings.models : (props.model ? [props.model] : []))
const activePreset = computed(() => settings.presetFor(mode.value))
const effectiveModel = computed(() => activePreset.value.model || settings.settings.model || props.model)
const reasoningEffort = computed({
  get: () => activePreset.value.reasoningEffort || 'medium',
  set: (value: ReasoningEffort) => {
    if (!settings.settings.modePresets) settings.settings.modePresets = {}
    settings.settings.modePresets[mode.value] = { ...activePreset.value, reasoningEffort: value }
    settings.persist()
  }
})
const selectedModel = computed({
  get: () => activePreset.value.model || settings.settings.model,
  set: (next: string) => {
    const selected = next.trim()
    if (!selected) return
    if (!settings.settings.modePresets) settings.settings.modePresets = {}
    settings.settings.modePresets[mode.value] = { ...activePreset.value, model: selected }
    settings.settings.models = Array.from(new Set([...(settings.settings.models || []), selected]))
    settings.persist()
  }
})
const mode = ref<ComposerMode>('coding')
const canSubmit = computed(() => !!value.value.trim() && !props.running)
const attachmentHint = ref(false)

function uid() {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`
}

async function paste(event: ClipboardEvent) {
  const clipboard = event.clipboardData
  if (!clipboard) return
  const files: ComposerAttachment[] = []
  for (const item of Array.from(clipboard.items)) {
    if (item.kind !== 'file') continue
    const file = item.getAsFile()
    if (!file || file.size > 8 * 1024 * 1024) continue
    if (file.type.startsWith('image/')) {
      files.push({ id: uid(), name: file.name || 'pasted-image', kind: 'image', mime: file.type, size: file.size, data: await toDataUrl(file) })
    } else if (file.type.startsWith('text/')) {
      files.push({ id: uid(), name: file.name || 'pasted-file', kind: 'text', mime: file.type, size: file.size, content: await file.text() })
    } else {
      files.push({ id: uid(), name: file.name || 'pasted-file', kind: 'file', mime: file.type || 'application/octet-stream', size: file.size })
    }
  }
  if (files.length) {
    event.preventDefault()
    emit('update:attachments', [...(props.attachments || []), ...files])
  }
}

function toDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

function removeAttachment(id: string) {
  emit('update:attachments', (props.attachments || []).filter((item) => item.id !== id))
}

function submit() {
  if (canSubmit.value) emit('submit', { attachments: props.attachments || [], mode: mode.value })
}
</script>

<template>
  <div class="composer" @paste="paste">
    <div v-if="attachments?.length" class="attachments">
      <span v-for="item in attachments" :key="item.id" class="attachment">
        <Icon :icon="item.kind === 'image' ? 'mdi:image-outline' : 'mdi:file-outline'" width="14" />
        {{ item.name }}
        <button type="button" title="移除附件" @click="removeAttachment(item.id)">×</button>
      </span>
    </div>

    <el-input
      v-model="value"
      class="composer-input"
      type="textarea"
      :autosize="{ minRows: 2, maxRows: 8 }"
      resize="none"
      placeholder="描述要完成的工作，或粘贴文件/图片…"
      @keydown.enter.exact.prevent="submit"
    />

    <footer class="composer-footer">
      <div class="composer-meta">
        <span class="workspace-meta" :title="workspaceName"><Icon icon="mdi:folder-open-outline" width="14" /> {{ workspaceName }}</span>
        <el-select v-model="mode" class="mode-select" size="small">
          <el-option value="coding" label="编码" />
          <el-option value="thinking" label="思考" />
          <el-option value="security" label="安全" />
        </el-select>
        <el-select v-model="selectedModel" class="model-select" size="small" filterable allow-create default-first-option :placeholder="effectiveModel || '选择模型'">
          <el-option v-for="option in modelOptions" :key="option" :label="option" :value="option" />
        </el-select>
        <el-select v-if="settings.settings.requestCapabilities?.reasoningEffort" v-model="reasoningEffort" class="reasoning-select" size="small" :title="`当前模式：${mode}`">
          <el-option value="low" label="思考 低" />
          <el-option value="medium" label="思考 中" />
          <el-option value="high" label="思考 高" />
        </el-select>
        <span v-else-if="activePreset.temperature !== undefined" class="preset-meta">T {{ activePreset.temperature.toFixed(1) }}</span>
        <span v-if="hasGithub" class="github-meta"><Icon icon="mdi:github" width="14" /> 已连接</span>
      </div>
      <div class="composer-actions">
        <button class="attachment-trigger" type="button" title="Ctrl+V 粘贴文件或图片" @click="attachmentHint = !attachmentHint">
          <Icon icon="mdi:paperclip" width="17" />
        </button>
        <small v-if="attachmentHint" class="composer-hint">可直接按 Ctrl+V 粘贴文件或图片</small>
        <el-button v-if="props.running" type="danger" text @click="emit('stop')">停止</el-button>
        <el-button v-else type="primary" :disabled="!canSubmit" @click="submit"><Icon icon="mdi:arrow-up" width="16" /> 发送</el-button>
      </div>
    </footer>
  </div>
</template>

<style scoped>
.composer {
  position: relative;
  width: min(920px, 100%);
  margin: 0 auto;
  overflow: visible;
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
  background: var(--surface-bg);
}
.composer:focus-within { border-color: var(--accent); }
.composer-input :deep(.el-textarea__inner) {
  min-height: calc(48px * var(--ui-space-scale)) !important;
  padding: var(--space-3) var(--space-3) var(--space-2);
  border: 0;
  box-shadow: none;
  color: var(--text-primary);
  background: transparent;
  line-height: 1.55;
}
.composer-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-2) var(--space-2) var(--space-3);
  border-top: 1px solid var(--glass-border);
  color: var(--text-secondary);
  font-size: 11px;
}
.composer-meta, .composer-actions { display: flex; align-items: center; gap: var(--space-2); min-width: 0; }
.workspace-meta, .github-meta {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
  max-width: 180px;
  overflow: hidden;
  color: var(--text-secondary);
  text-overflow: ellipsis;
  white-space: nowrap;
}
.github-meta { color: var(--accent); }
.model-select { width: 148px; }
.mode-select { width: 74px; }
.reasoning-select { width: 96px; }
.preset-meta { color: var(--text-faint); font: 11px 'Cascadia Code', Consolas, monospace; white-space: nowrap; }
.attachment-trigger {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border: 0;
  border-radius: var(--radius-sm);
  color: var(--text-secondary);
  background: transparent;
  cursor: pointer;
}
.attachment-trigger:hover { color: var(--text-primary); background: var(--hover-bg); }
.composer-hint {
  position: absolute;
  right: 72px;
  bottom: calc(42px * var(--ui-space-scale));
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-sm);
  color: var(--text-secondary);
  background: var(--surface-bg);
  white-space: nowrap;
}
.attachments { display: flex; flex-wrap: wrap; gap: var(--space-2); padding: var(--space-2) var(--space-3) 0; }
.attachment {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px var(--space-2);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-sm);
  color: var(--text-secondary);
  background: var(--panel-bg);
  font-size: 11px;
}
.attachment button { border: 0; background: transparent; color: inherit; cursor: pointer; font-size: 16px; line-height: 1; }
@media (max-width: 700px) {
  .composer-footer { align-items: flex-end; }
  .composer-meta { flex-wrap: wrap; }
  .workspace-meta { display: none; }
}
</style>
