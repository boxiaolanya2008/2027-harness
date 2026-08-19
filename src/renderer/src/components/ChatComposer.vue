<script setup lang="ts">
import { computed, ref } from 'vue'
import { Icon } from '@iconify/vue'
import { useSettingsStore } from '@/stores/settings'
import type { ComposerAttachment, ComposerMode } from '@/types'
const props = defineProps<{ modelValue: string; running: boolean; workspaceName: string; model: string; hasGithub: boolean; attachments?: ComposerAttachment[] }>()
const emit = defineEmits<{ (event: 'update:modelValue', value: string): void; (event: 'submit', payload: { attachments: ComposerAttachment[]; mode: ComposerMode }): void; (event: 'stop'): void; (event: 'update:attachments', value: ComposerAttachment[]): void }>()
const settings = useSettingsStore()
const value = computed({ get: () => props.modelValue, set: (next) => emit('update:modelValue', next) })
const modelDraft = ref(props.model)
const modelEditing = ref(false)
const modelOptions = computed(() => settings.settings.models?.length ? settings.settings.models : (props.model ? [props.model] : []))
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
function saveModel() { const next = modelDraft.value.trim(); if (next) { settings.settings.model = next; settings.settings.models = Array.from(new Set([...(settings.settings.models || []), next])); settings.persist() }; modelEditing.value = false }
function selectModel(next: string) { settings.settings.model = next; modelDraft.value = next; settings.persist() }
</script>
<template>
  <div class="composer" @paste="paste">
    <div v-if="attachments?.length" class="attachments"><span v-for="item in attachments" :key="item.id" class="attachment"><Icon :icon="item.kind === 'image' ? 'mdi:image-outline' : 'mdi:file-outline'" width="15" /> {{ item.name }} <button @click="removeAttachment(item.id)">×</button></span></div>
    <el-input v-model="value" type="textarea" :autosize="{ minRows: 2, maxRows: 8 }" resize="none" placeholder="描述要完成的工作，或粘贴文件/图片…" @keydown.enter.exact.prevent="canSubmit && emit('submit', { attachments: attachments || [], mode })" />
    <div class="composer-foot">
      <div class="composer-context">
        <span class="composer-chip"><Icon icon="mdi:folder-open-outline" width="15" /> {{ workspaceName }}</span>
        <el-popover v-model:visible="modelEditing" trigger="click" width="280"><template #reference><button class="composer-chip model-chip" type="button"><Icon icon="mdi:creation-outline" width="15" /> {{ model || '未配置模型' }}</button></template><div class="model-picker"><strong>选择模型</strong><button v-for="option in modelOptions" :key="option" class="model-option" :class="{ active: option === model }" @click="selectModel(option)">{{ option }}</button><el-input v-model="modelDraft" placeholder="输入新模型名称" @keyup.enter="saveModel" /><el-button type="primary" size="small" @click="saveModel">添加并使用</el-button></div></el-popover>
        <el-select v-model="mode" size="small" class="mode-select"><el-option value="coding" label="编码专用" /><el-option value="thinking" label="极致思考" /><el-option value="security" label="破甲模式（授权安全）" /></el-select>
        <span v-if="hasGithub" class="composer-chip composer-chip--status"><Icon icon="mdi:github" width="15" /> GitHub</span>
        <button class="composer-add" type="button" title="Ctrl+V 粘贴文件或图片" @click="attachmentHint = !attachmentHint"><Icon icon="mdi:paperclip" width="17" /></button>
        <small v-if="attachmentHint" class="composer-hint">直接按 Ctrl+V 粘贴文件或图片</small>
      </div>
      <div class="composer-actions"><span class="shortcut">Enter 发送</span><el-button v-if="props.running" type="danger" text @click="emit('stop')">停止</el-button><el-button v-else type="primary" :disabled="!canSubmit" @click="emit('submit', { attachments: attachments || [], mode })"><Icon icon="mdi:arrow-up" width="16" /> 发送</el-button></div>
    </div>
  </div>
</template>
<style scoped>
.composer { position: relative; width: min(900px, 100%); margin: 0 auto; overflow: visible; border: 1px solid var(--glass-border); border-radius: 10px; background: var(--surface-bg); box-shadow: 0 4px 14px rgba(20,24,32,.05); transition: border-color 180ms ease, box-shadow 180ms ease, transform 180ms ease; }
.composer:focus-within { border-color: var(--accent); box-shadow: 0 0 0 3px var(--focus-ring); transform: translateY(-1px); }
.composer :deep(.el-textarea__inner) { min-height: 52px !important; padding: 13px 14px 8px; border: 0; box-shadow: none; color: var(--text-primary); background: transparent; line-height: 1.6; }
.composer-foot { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 7px 8px 8px 10px; color: var(--text-faint); font-size: 11px; }
.composer-context, .composer-actions { display: flex; align-items: center; gap: 6px; min-width: 0; }
.composer-chip, .composer-add { display: inline-flex; align-items: center; gap: 5px; max-width: 190px; padding: 4px 7px; overflow: hidden; border: 0; border-radius: 6px; color: var(--text-secondary); background: transparent; font-size: 11px; text-overflow: ellipsis; white-space: nowrap; }
.composer-chip--status { color: #2d9560; }.model-chip { cursor: pointer; }.model-option { width:100%; padding:7px 8px; border:0; border-radius:6px; color:var(--text-secondary); background:transparent; text-align:left; cursor:pointer; }.model-option:hover, .model-option.active { color:var(--text-primary); background:var(--selected-bg); }.composer-add { cursor: pointer; }.composer-add:hover { color: var(--accent); background: var(--hover-bg); }.model-picker { display:flex; flex-direction:column; gap:9px; }.model-picker strong { font-size:12px; }.composer-hint { position: absolute; bottom: 50px; left: 115px; padding: 7px 9px; border: 1px solid var(--glass-border); border-radius: 7px; color: var(--text-secondary); background: var(--surface-bg); box-shadow: 0 5px 18px rgba(20,24,32,.12); }.attachments { display: flex; gap: 6px; padding: 8px 10px 0; flex-wrap: wrap; }.attachment { display: inline-flex; align-items: center; gap: 5px; padding: 4px 7px; border-radius: 6px; color: var(--text-secondary); background: var(--hover-bg); font-size: 11px; }.attachment button { border: 0; background: transparent; color: inherit; cursor: pointer; }.mode-select { width: 92px; }.shortcut { color: var(--text-faint); }
</style>
