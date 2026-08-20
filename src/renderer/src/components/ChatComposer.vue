<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { Icon } from '@iconify/vue'
import { useSettingsStore } from '@/stores/settings'
import type { ComposerAddAction, ComposerAttachment, ComposerMode, ComposerPluginItem, ReasoningEffort } from '@/types'
import SkillAutocomplete from '@/components/SkillAutocomplete.vue'
import ComposerAddMenu from '@/components/ComposerAddMenu.vue'
import ApprovalMenu from '@/components/ApprovalMenu.vue'
import ModelReasoningPopover from '@/components/ModelReasoningPopover.vue'
import { useSkills } from '@/api/skills'
import { activeAtMention, isSlashTrigger } from '@/utils/skillParser'

const props = withDefaults(defineProps<{
  modelValue: string
  running: boolean
  workspaceName: string
  workspace?: string | null
  model: string
  hasGithub: boolean
  attachments?: ComposerAttachment[]
  addMenuActions?: ComposerAddAction[]
  addMenuPlugins?: ComposerPluginItem[]
}>(), {
  attachments: () => [],
  addMenuActions: () => [],
  addMenuPlugins: () => []
})
const emit = defineEmits<{
  (event: 'update:modelValue', value: string): void
  (event: 'submit', payload: { attachments: ComposerAttachment[]; mode: ComposerMode }): void
  (event: 'stop'): void
  (event: 'update:attachments', value: ComposerAttachment[]): void
  (event: 'selectAddAction', key: string): void
  (event: 'selectPlugin', key: string): void
  (event: 'requestApprove'): void
  (event: 'rename'): void
}>()

const settings = useSettingsStore()
const { skills, refresh, bindWorkspace } = useSkills()
bindWorkspace(() => props.workspace || null)
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
const reasoningLabel = computed(() => {
  const v = reasoningEffort.value
  if (v === 'high') return '高'
  if (v === 'low') return '低'
  return '中'
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
const showAddMenu = ref(false)
const showApprovalMenu = ref(false)
const showModelPopover = ref(false)
const composerRoot = ref<HTMLElement | null>(null)
const inputRef = ref<any>(null)

// Codex-style approval mode, persisted via settings store
const approvalMode = computed(() => (settings.settings.approvalMode as import('@/types').ApprovalMode) || 'help')
const approvalLabel = computed(() => {
  if (approvalMode.value === 'request') return '请求批准'
  if (approvalMode.value === 'full') return '完全访问'
  return '帮我批准'
})
const approvalIcon = computed(() => {
  if (approvalMode.value === 'request') return 'mdi:hand-back-right-outline'
  if (approvalMode.value === 'full') return 'mdi:alert-circle-outline'
  return 'mdi:shield-check-outline'
})
function setApprovalMode(v: import('@/types').ApprovalMode) {
  settings.setApprovalMode(v)
  showApprovalMenu.value = false
}
function toggleApprovalMenu() {
  showApprovalMenu.value = !showApprovalMenu.value
  if (showApprovalMenu.value) {
    showAddMenu.value = false
    showModelPopover.value = false
  }
}
function toggleModelPopover() {
  showModelPopover.value = !showModelPopover.value
  if (showModelPopover.value) {
    showAddMenu.value = false
    showApprovalMenu.value = false
  }
}

type ActiveTrigger = { kind: 'slash'; query: string; start: number; end: number } | { kind: 'at'; query: string; start: number; end: number }
const activeTrigger = ref<ActiveTrigger | null>(null)
const activeIndex = ref(0)

function getTextarea(): HTMLTextAreaElement | null {
  const el = inputRef.value as any
  if (el?.textarea) return el.textarea as HTMLTextAreaElement
  if (el?.$el) {
    const found = el.$el.querySelector?.('textarea')
    if (found) return found as HTMLTextAreaElement
  }
  return document.querySelector('.composer-input textarea') as HTMLTextAreaElement | null
}

function getCursor(): number {
  const ta = getTextarea()
  return ta?.selectionStart ?? value.value.length
}

function updateTrigger() {
  if (props.running) {
    activeTrigger.value = null
    return
  }
  const text = value.value
  const cursor = getCursor()
  const slash = isSlashTrigger(text, cursor)
  if (slash) {
    const before = text.slice(0, cursor)
    const lineStart = before.lastIndexOf('\n') + 1
    const slashIndex = before.indexOf('/', lineStart)
    const start = slashIndex >= 0 ? slashIndex : cursor - slash.query.length - 1
    activeTrigger.value = { kind: 'slash', query: slash.query, start: Math.max(0, start), end: cursor }
    activeIndex.value = 0
    return
  }
  const at = activeAtMention(text, cursor)
  if (at) {
    activeTrigger.value = { kind: 'at', query: at.query, start: at.start, end: at.end }
    activeIndex.value = 0
    return
  }
  activeTrigger.value = null
}

const filteredSkills = computed(() => {
  const trigger = activeTrigger.value
  if (!trigger) return []
  const q = trigger.query.toLowerCase()
  const list = skills.value || []
  if (!q) return list.slice(0, 20)
  return list.filter((item) => item.name.toLowerCase().includes(q) || item.description.toLowerCase().includes(q)).slice(0, 20)
})

const showAutocomplete = computed(() => !!activeTrigger.value)
const isSlashMode = computed(() => activeTrigger.value?.kind === 'slash')
const emptyText = computed(() => {
  if (!skills.value.length) return `暂无技能，在 ${props.workspace || '工作区'}/.claude/skills/ 添加 SKILL.md`
  return '暂无匹配的技能'
})

function toggleAddMenu() {
  showAddMenu.value = !showAddMenu.value
  if (showAddMenu.value) {
    activeTrigger.value = null
    showApprovalMenu.value = false
    showModelPopover.value = false
  }
}

function handleAddAction(key: string) {
  showAddMenu.value = false
  emit('selectAddAction', key)
}

function handlePlugin(key: string) {
  showAddMenu.value = false
  emit('selectPlugin', key)
}

function onClickOutside(event: MouseEvent) {
  const target = event.target as HTMLElement
  if (composerRoot.value && !composerRoot.value.contains(target)) {
    showAddMenu.value = false
    showApprovalMenu.value = false
    showModelPopover.value = false
  } else {
    const insideApproval = target.closest('.approval-menu')
    const isApprovalBtn = target.closest('.approve-btn')
    if (showApprovalMenu.value && !insideApproval && !isApprovalBtn) showApprovalMenu.value = false
    const insideModel = target.closest('.model-popover')
    const isModelTrigger = target.closest('.model-trigger')
    if (showModelPopover.value && !insideModel && !isModelTrigger) showModelPopover.value = false
  }
}

function selectSkill(name: string) {
  const trigger = activeTrigger.value
  if (!trigger) return
  const text = value.value
  const insert = trigger.kind === 'slash' ? `/${name} ` : `@${name} `
  const next = text.slice(0, trigger.start) + insert + text.slice(trigger.end)
  value.value = next
  activeTrigger.value = null
  nextTick(() => {
    const ta = getTextarea()
    if (ta) {
      const pos = trigger.start + insert.length
      ta.focus()
      ta.setSelectionRange(pos, pos)
    }
    updateTrigger()
  })
}

function onKeydown(event: KeyboardEvent) {
  if ((showAddMenu.value || showApprovalMenu.value || showModelPopover.value) && event.key === 'Escape') {
    event.preventDefault()
    showAddMenu.value = false
    showApprovalMenu.value = false
    showModelPopover.value = false
    return
  }
  if (showAutocomplete.value && filteredSkills.value.length) {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      event.stopPropagation()
      activeIndex.value = (activeIndex.value + 1) % filteredSkills.value.length
      return
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      event.stopPropagation()
      activeIndex.value = (activeIndex.value - 1 + filteredSkills.value.length) % filteredSkills.value.length
      return
    }
    if (event.key === 'Enter' || event.key === 'Tab') {
      event.preventDefault()
      event.stopPropagation()
      const target = filteredSkills.value[activeIndex.value]
      if (target) selectSkill(target.name)
      return
    }
  }
  if (event.key === 'Escape' && showAutocomplete.value) {
    event.preventDefault()
    activeTrigger.value = null
    return
  }
  if (event.key === 'Enter' && !event.shiftKey && !event.ctrlKey && !event.metaKey && !event.altKey) {
    if (showAutocomplete.value && filteredSkills.value.length) {
      event.preventDefault()
      const target = filteredSkills.value[activeIndex.value]
      if (target) selectSkill(target.name)
      return
    }
  }
}

function onInput() {
  if (showAddMenu.value) showAddMenu.value = false
  if (showApprovalMenu.value) showApprovalMenu.value = false
  if (showModelPopover.value) showModelPopover.value = false
  nextTick(updateTrigger)
}

function onFocus() {
  void refresh()
  nextTick(updateTrigger)
}

function onBlur() {
  window.setTimeout(() => {
    activeTrigger.value = null
  }, 150)
}

watch(() => props.modelValue, () => nextTick(updateTrigger))
watch(() => props.workspace, () => nextTick(updateTrigger))

if (typeof window !== 'undefined') {
  window.addEventListener('click', onClickOutside)
  onBeforeUnmount(() => window.removeEventListener('click', onClickOutside))
}

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
  if (showAutocomplete.value && filteredSkills.value.length) {
    const target = filteredSkills.value[activeIndex.value]
    if (target) {
      selectSkill(target.name)
      return
    }
  }
  if (canSubmit.value) emit('submit', { attachments: props.attachments || [], mode: mode.value })
}
</script>

<template>
  <div ref="composerRoot" class="composer" @paste="paste">
    <ComposerAddMenu
      v-if="showAddMenu"
      :actions="addMenuActions"
      :plugins="addMenuPlugins"
      @select-action="handleAddAction"
      @select-plugin="handlePlugin"
    />
    <SkillAutocomplete
      v-if="showAutocomplete"
      :items="filteredSkills"
      :active-index="activeIndex"
      :empty-text="emptyText"
      :show-rename-header="isSlashMode"
      @select="selectSkill"
      @hover="activeIndex = $event"
      @rename="emit('rename')"
    />

    <!-- 输入区：自适应 textarea（已修复此前未输入"@"却显示"@"的问题） -->
    <div class="composer-input-area">
      <div class="input-row">
        <el-input
          ref="inputRef"
          v-model="value"
          class="composer-input"
          type="textarea"
          :autosize="{ minRows: 1, maxRows: 6 }"
          resize="none"
          placeholder="询问任何问题"
          @keydown="onKeydown"
          @keydown.enter.exact.prevent="submit"
          @input="onInput"
          @keyup="onInput"
          @click="onInput"
          @focus="onFocus"
          @blur="onBlur"
        />
      </div>
      <div v-if="attachments?.length" class="attachments">
        <span v-for="item in attachments" :key="item.id" class="attachment">
          <Icon :icon="item.kind === 'image' ? 'mdi:image-outline' : 'mdi:file-outline'" width="14" />
          {{ item.name }}
          <button type="button" title="移除附件" @click="removeAttachment(item.id)">×</button>
        </span>
      </div>
    </div>

    <footer class="composer-footer composer-footer--new">
      <div class="footer-left">
        <button class="plus-btn" type="button" :class="{ active: showAddMenu }" title="添加" @click.stop="toggleAddMenu">
          <Icon icon="mdi:plus" width="18" />
        </button>
        <div class="approve-wrap">
          <button
            class="approve-btn"
            type="button"
            :class="{ 'approve-btn--full': approvalMode === 'full', 'approve-btn--request': approvalMode === 'request' }"
            :title="approvalMode === 'full' ? '完全访问：所有工具自动执行' : approvalMode === 'request' ? '请求批准：所有工具均需确认' : '帮我批准：仅风险操作需确认'"
            @click.stop="toggleApprovalMenu"
          >
            <Icon :icon="approvalIcon" width="16" />
            <span>{{ approvalLabel }}</span>
          </button>
          <ApprovalMenu
            v-if="showApprovalMenu"
            :model-value="approvalMode"
            @update:model-value="setApprovalMode"
          />
        </div>
        <span class="workspace-meta--new" :title="workspaceName"><Icon icon="mdi:folder-open-outline" width="14" /> {{ workspaceName }}</span>
        <el-select v-model="mode" class="mode-select mode-select--compact" size="small">
          <el-option value="coding" label="编码" />
          <el-option value="thinking" label="思考" />
          <el-option value="security" label="安全" />
        </el-select>
      </div>
      <div class="footer-right">
        <!-- 复刻图二：模型/推理强度触发器 + 弹出面板（仅布局） -->
        <div class="model-popover-wrap">
          <button class="model-pill-trigger" type="button" @click.stop="toggleModelPopover">
            <Icon icon="mdi:loading" width="14" class="model-pill-icon" />
            <span class="model-pill-text" :title="effectiveModel">{{ effectiveModel || 'muse-spark-1.2-contr...' }}</span>
            <span class="model-pill-effort">{{ reasoningLabel }}</span>
          </button>
          <ModelReasoningPopover
            v-if="showModelPopover"
            :model="effectiveModel || 'muse-spark-1.2-contr...'"
            :reasoning-label="reasoningLabel"
            @select-model="showModelPopover = false"
            @select-reasoning="showModelPopover = false"
          />
          <!-- 保留隐藏的功能性选择器，供设置持久化（布局上不可见，仅保证数据链路） -->
          <el-select v-model="selectedModel" class="model-select--hidden" size="small" filterable allow-create>
            <el-option v-for="option in modelOptions" :key="option" :label="option" :value="option" />
          </el-select>
        </div>
        <span v-if="hasGithub" class="github-meta"><Icon icon="mdi:github" width="12" /></span>
        <button v-if="props.running" class="stop-btn" type="button" @click="emit('stop')">停止</button>
        <button v-else class="send-btn" type="button" :disabled="!canSubmit" :class="{ disabled: !canSubmit }" @click="submit">
          <Icon icon="mdi:arrow-up" width="18" />
        </button>
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
  border-radius: 16px;
  background: var(--surface-bg);
  box-shadow: 0 2px 12px rgba(0,0,0,0.04);
}
.composer:focus-within { border-color: var(--glass-border); box-shadow: 0 4px 16px rgba(0,0,0,0.06); }

/* 输入区 */
.composer-input-area {
  padding: 10px 14px 6px;
}
.input-row {
  display: flex;
  align-items: flex-start;
  gap: 6px;
}
.composer-input {
  flex: 1;
  min-width: 0;
}
.composer-input :deep(.el-textarea__inner) {
  min-height: 28px !important;
  padding: 6px 0;
  border: 0;
  box-shadow: none;
  color: var(--text-primary);
  background: transparent;
  line-height: 1.55;
  font-size: 14px;
}
.composer-input :deep(.el-textarea__inner)::placeholder {
  color: var(--text-faint);
}

/* 附件 */
.attachments { display: flex; flex-wrap: wrap; gap: var(--space-2); padding-top: 6px; }
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

/* 新底部栏 */
.composer-footer--new {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 8px 10px 10px;
  border-top: 0;
}
.footer-left, .footer-right {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.footer-right { margin-left: auto; }

.plus-btn {
  display: grid;
  place-items: center;
  width: 30px;
  height: 30px;
  border: 1px solid var(--glass-border);
  border-radius: 50%;
  background: var(--surface-bg);
  color: var(--text-secondary);
  cursor: pointer;
}
.plus-btn:hover, .plus-btn.active {
  background: var(--hover-bg);
  color: var(--text-primary);
  border-color: var(--text-faint);
}

.approve-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  border: 1px solid var(--glass-border);
  border-radius: 999px;
  background: var(--surface-bg);
  color: var(--text-secondary);
  font-size: 12px;
  cursor: pointer;
}
.approve-btn:hover { background: var(--hover-bg); color: var(--text-primary); }
.approve-wrap { position: relative; display: inline-flex; }
.approve-btn--full {
  color: #e65100;
  border-color: rgba(230, 81, 0, 0.3);
  background: rgba(230, 81, 0, 0.08);
}
.approve-btn--full:hover {
  background: rgba(230, 81, 0, 0.12);
  color: #bf360c;
}
.approve-btn--request {
  color: var(--text-primary);
}

.workspace-meta--new {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  max-width: 140px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--text-faint);
  font-size: 11px;
}
.mode-select--compact { width: 86px; }
.model-popover-wrap { position: relative; display: inline-flex; align-items: center; }
.model-pill-trigger {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  border: 1px solid var(--glass-border);
  border-radius: 999px;
  background: var(--panel-bg);
  color: var(--text-secondary);
  font-size: 12px;
  cursor: pointer;
  max-width: 220px;
}
.model-pill-trigger:hover { background: var(--hover-bg); color: var(--text-primary); }
.model-pill-icon { flex: 0 0 auto; color: var(--text-faint); animation: spin 1.1s linear infinite; }
.model-pill-text {
  flex: 1;
  min-width: 0;
  max-width: 150px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--text-secondary);
}
.model-pill-effort {
  flex: 0 0 auto;
  padding: 2px 6px;
  border-radius: 6px;
  background: var(--surface-bg);
  border: 1px solid var(--glass-border);
  color: var(--text-faint);
  font-size: 11px;
}
.model-select--hidden { position: absolute; width: 0; height: 0; opacity: 0; pointer-events: none; }
@keyframes spin { to { transform: rotate(360deg); } }
.github-meta {
  display: grid;
  place-items: center;
  color: var(--text-faint);
}

.stop-btn {
  padding: 6px 14px;
  border-radius: 999px;
  border: 1px solid var(--glass-border);
  background: var(--surface-bg);
  color: var(--text-primary);
  cursor: pointer;
  font-size: 12px;
}
.send-btn {
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  border: 0;
  border-radius: 50%;
  background: #111;
  color: white;
  cursor: pointer;
}
html[data-theme='light'] .send-btn { background: #111; }
html[data-theme='dark'] .send-btn { background: #fff; color: #111; }
.send-btn.disabled {
  opacity: 0.35;
  cursor: not-allowed;
}
.send-btn:not(.disabled):hover { opacity: 0.85; }

@media (max-width: 700px) {
  .workspace-meta--new { display: none; }
  .model-select--ghost { width: 120px; }
}
</style>
