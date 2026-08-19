<script setup lang="ts">
import { computed, ref } from 'vue'
import { Icon } from '@iconify/vue'
import { useSettingsStore } from '@/stores/settings'
import type { ComposerAttachment, ComposerMode } from '@/types'
const props = defineProps<{ modelValue: string; running: boolean; workspaceName: string; model: string; hasGithub: boolean; attachments?: ComposerAttachment[] }>()
const emit = defineEmits<{ (event: 'update:modelValue', value: string): void; (event: 'submit', payload: { attachments: ComposerAttachment[]; mode: ComposerMode }): void; (event: 'stop'): void; (event: 'update:attachments', value: ComposerAttachment[]): void }>()
const settings = useSettingsStore()
const value = computed({ get: () => props.modelValue, set: (next) => emit('update:modelValue', next) })
const modelOptions = computed(() => settings.settings.models?.length ? settings.settings.models : (props.model ? [props.model] : []))
const selectedModel = computed({ get: () => settings.settings.model, set: (next: string) => { const value = next.trim(); if (!value) return; settings.settings.model = value; settings.settings.models = Array.from(new Set([...(settings.settings.models || []), value])); settings.persist() } })
const mode = ref<ComposerMode>('coding')
const canSubmit = computed(() => !!value.value.trim() && !props.running)
const attachmentHint = ref(false)

function uid() { return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}` }
async function paste(event: ClipboardEvent) {
  const clipboard = event.clipboardData
  if (!clipboard) return
  const files: ComposerAttachment[] = []
  for (const item of Array.from(clipboard.items)) {
    if (item.kind === 'file') {
      const file = item.getAsFile()
      if (!file || file.size > 8 * 1024 * 1024) continue
      if (file.type.startsWith('image/')) files.push({ id: uid(), name: file.name || 'pasted-image', kind: 'image', mime: file.type, size: file.size, data: await toDataUrl(file) })
      else if (file.type.startsWith('text/')) files.push({ id: uid(), name: file.name || 'pasted-file', kind: 'text', mime: file.type, size: file.size, content: await file.text() })
      else files.push({ id: uid(), name: file.name || 'pasted-file', kind: 'file', mime: file.type || 'application/octet-stream', size: file.size })
    }
  }
  if (files.length) { event.preventDefault(); emit('update:attachments', [...(props.attachments || []), ...files]) }
}
function toDataUrl(file: File) { return new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(file) }) }
function removeAttachment(id: string) { emit('update:attachments', (props.attachments || []).filter((item) => item.id !== id)) }
</script>
<template>
  <div class="composer" @paste="paste">
    <div v-if="attachments?.length" class="attachments"><span v-for="item in attachments" :key="item.id" class="attachment"><Icon :icon="item.kind === 'image' ? 'mdi:image-outline' : 'mdi:file-outline'" width="15" /> {{ item.name }} <button @click="removeAttachment(item.id)">×</button></span></div>
    <el-input v-model="value" type="textarea" :autosize="{ minRows: 2, maxRows: 8 }" resize="none" placeholder="描述要完成的工作，或粘贴文件/图片…" @keydown.enter.exact.prevent="canSubmit && emit('submit', { attachments: attachments || [], mode })" />
    <div class="composer-foot">
      <div class="composer-context">
        <span class="composer-chip"><Icon icon="mdi:folder-open-outline" width="15" /> {{ workspaceName }}</span>
        <el-select v-model="selectedModel" class="mode-select model-select" size="small" filterable allow-create default-first-option placeholder="选择模型"><el-option v-for="option in modelOptions" :key="option" :label="option" :value="option" /></el-select>
        <el-select v-model="mode" size="small" class="mode-select"><el-option value="coding" label="编码专用" /><el-option value="thinking" label="极致思考" /><el-option value="security" label="破甲模式（授权安全）" /></el-select>
        <span v-if="hasGithub" class="composer-chip composer-chip--status"><Icon icon="mdi:github" width="15" /> GitHub</span>
        <button class="composer-add" type="button" title="Ctrl+V 粘贴文件或图片" @click="attachmentHint = !attachmentHint"><Icon icon="mdi:paperclip" width="17" /></button>
        <small v-if="attachmentHint" class="composer-hint">直接按 Ctrl+V 粘贴文件或图片</small>
      </div>
      <div class="composer-actions"><el-button v-if="props.running" type="danger" text @click="emit('stop')">停止</el-button><el-button v-else type="primary" :disabled="!canSubmit" @click="emit('submit', { attachments: attachments || [], mode })"><Icon icon="mdi:arrow-up" width="16" /> 发送</el-button></div>
    </div>
  </div>
</template>
<style scoped>
.composer { position: relative; width: min(900px, 100%); margin: 0 auto; overflow: visible; border: 1px solid var(--glass-border); border-radius: 3px; background: var(--surface-bg); }
.composer:focus-within { border-color: var(--accent); }
.composer :deep(.el-textarea__inner) { min-height: 44px !important; padding: 8px 10px 4px; border: 0; box-shadow: none; color: var(--text-primary); background: transparent; line-height: 1.5; }
.composer-foot { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 4px 6px 6px 8px; color: var(--text-secondary); font-size: 11px; }
.composer-context, .composer-actions { display: flex; align-items: center; gap: 4px; min-width: 0; }
.composer-chip, .composer-add { display: inline-flex; align-items: center; gap: 4px; max-width: 190px; padding: 2px 6px; overflow: hidden; border: 0; border-radius: 3px; color: var(--text-secondary); background: transparent; font-size: 11px; text-overflow: ellipsis; white-space: nowrap; }
.composer-chip--status { color: var(--text-secondary); }.model-chip { cursor: pointer; }.model-option { width:100%; padding:6px 8px; border:0; border-radius:3px; color:var(--text-secondary); background:transparent; text-align:left; cursor:pointer; }.model-option:hover, .model-option.active { color:var(--text-primary); background:var(--selected-bg); }.composer-add { cursor: pointer; }.composer-add:hover { color: var(--text-primary); background: var(--hover-bg); }.model-picker { display:flex; flex-direction:column; gap:8px; }.model-picker strong { font-size:12px; }.composer-hint { position: absolute; bottom: 42px; left: 96px; padding: 6px 8px; border: 1px solid var(--glass-border); border-radius: 3px; color: var(--text-secondary); background: var(--surface-bg); }.attachments { display: flex; gap: 6px; padding: 6px 8px 0; flex-wrap: wrap; }.attachment { display: inline-flex; align-items: center; gap: 5px; padding: 2px 6px; border: 1px solid var(--glass-border); border-radius: 3px; color: var(--text-secondary); background: var(--panel-bg); font-size: 11px; }.attachment button { border: 0; background: transparent; color: inherit; cursor: pointer; }.mode-select { width: 92px; }.shortcut { color: var(--text-secondary); }
</style>
