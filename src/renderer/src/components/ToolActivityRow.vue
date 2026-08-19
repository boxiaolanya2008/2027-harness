<script setup lang="ts">
import { computed, ref } from 'vue'
import { Icon } from '@iconify/vue'
import FileDiffView from './FileDiffView.vue'
import { getDiffStats } from '@/utils/fileDiff'
import type { ToolCall, WriteFilePreview } from '@/types'

interface FileSnapshot {
  before: string | null
  after: string | null
  path: string
  operation: string
}

const props = withDefaults(defineProps<{
  call: ToolCall
  rawArgs?: string
  result?: string
  writePreview?: WriteFilePreview
}>(), {
  rawArgs: undefined,
  result: undefined
})

const open = ref(false)
const rawArguments = computed(() => {
  if (props.rawArgs !== undefined) return props.rawArgs
  try {
    return JSON.stringify(props.call.args ?? {}, null, 2)
  } catch {
    return String(props.call.args)
  }
})
const output = computed(() => props.result ?? props.call.result)
const state = computed(() => props.call.status || 'running')
const stateLabel = computed(() => ({ running: '运行中', done: '已完成', error: '失败' }[state.value] || state.value))
const stateIcon = computed(() => ({ running: 'mdi:loading', done: 'mdi:check-circle', error: 'mdi:alert-circle' }[state.value] || 'mdi:tools'))
const filePath = computed(() => typeof props.call.args?.path === 'string' ? props.call.args.path : '')

function asText(value: unknown): string | null {
  return typeof value === 'string' ? value : value == null ? null : String(value)
}

function stateContent(value: unknown): string | null | undefined {
  if (value === undefined) return undefined
  if (value === null || typeof value === 'string') return value
  if (typeof value === 'object' && !Array.isArray(value)) {
    const state = value as Record<string, unknown>
    if (state.exists === false) return null
    if (typeof state.content === 'string') return state.content
  }
  return undefined
}

function snapshotFrom(value: unknown): FileSnapshot | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  const data = value as Record<string, unknown>
  const beforeRaw = data.before ?? data.beforeContent ?? data.previous ?? data.oldContent
  const afterRaw = data.after ?? data.afterContent ?? data.newContent ?? data.content
  const before = stateContent(beforeRaw)
  const after = stateContent(afterRaw)
  const path = data.path ?? data.filePath
  if ((beforeRaw === undefined && afterRaw === undefined) || (path !== undefined && typeof path !== 'string')) return undefined
  if (beforeRaw !== undefined && before === undefined) return undefined
  if (afterRaw !== undefined && after === undefined) return undefined
  return {
    before: before ?? null,
    after: after ?? null,
    path: asText(path) || '',
    operation: asText(data.operation ?? data.action ?? data.type) || (before == null ? 'create' : 'update')
  }
}

function parseSnapshot(raw: string | undefined): FileSnapshot | undefined {
  if (!raw?.trim()) return undefined
  try {
    const parsed: unknown = JSON.parse(raw)
    const direct = snapshotFrom(parsed)
    if (direct) return direct
    if (parsed && typeof parsed === 'object') {
      const wrapped = parsed as Record<string, unknown>
      for (const key of ['snapshot', 'fileSnapshot', 'file', 'data']) {
        const nested = snapshotFrom(wrapped[key])
        if (nested) return nested
      }
    }
  } catch {
    // Non-JSON tool output has no file snapshot to render.
  }
  return undefined
}

const diffSnapshot = computed(() => {
  if (props.call.name !== 'write_file') return undefined
  const snapshot = parseSnapshot(output.value)
  if (snapshot) {
    const content = asText(props.call.args?.content)
    return { ...snapshot, path: snapshot.path || filePath.value, after: snapshot.after ?? content, preview: false }
  }
  const preview = props.writePreview
  if (!preview || preview.before.state === 'unknown') return undefined
  return {
    path: preview.path || filePath.value,
    before: preview.before.content,
    after: preview.proposedContent,
    operation: preview.operation,
    preview: true
  }
})
const diffStats = computed(() => diffSnapshot.value
  ? getDiffStats(diffSnapshot.value.before, diffSnapshot.value.after)
  : undefined)
</script>

<template>
  <article class="tool-activity" :class="[`tool-activity--${state}`, { 'tool-activity--open': open }]">
    <button class="tool-activity-row" type="button" :aria-expanded="open" @click="open = !open">
      <Icon class="tool-chevron" :class="{ 'tool-chevron--open': open }" icon="mdi:chevron-right" width="16" />
      <Icon class="tool-icon" :class="{ 'tool-icon--spinning': state === 'running' }" :icon="stateIcon" width="16" />
      <code class="tool-name">{{ call.name || 'unknown_tool' }}</code>
      <code v-if="call.name === 'write_file' && filePath" class="tool-path">{{ filePath }}</code>
      <span class="tool-state">{{ diffSnapshot?.preview && state === 'running' ? '准备写入' : stateLabel }}</span>
      <span v-if="diffStats" class="tool-diff-summary">+{{ diffStats.additions }} −{{ diffStats.deletions }}</span>
    </button>

    <div v-if="open" class="tool-detail">
      <section class="tool-detail-section">
        <span class="tool-detail-label">参数</span>
        <pre class="tool-code">{{ rawArguments }}</pre>
      </section>
      <section v-if="output !== undefined" class="tool-detail-section">
        <span class="tool-detail-label">{{ state === 'error' ? '错误详情' : '工具结果' }}</span>
        <pre class="tool-code tool-result">{{ output }}</pre>
      </section>
      <section v-if="diffSnapshot" class="tool-detail-section">
        <span class="tool-detail-label">Diff</span>
        <FileDiffView
          :before="diffSnapshot.before"
          :after="diffSnapshot.after"
          :path="diffSnapshot.path"
          :operation="diffSnapshot.operation"
        />
      </section>
    </div>
  </article>
</template>

<style scoped>
.tool-activity {
  margin: var(--space-1) 0;
  border-bottom: 1px solid var(--glass-border);
  color: var(--text-secondary);
  font-size: 12px;
}
.tool-activity-row {
  width: 100%;
  min-width: 0;
  padding: 6px var(--space-2);
  border: 0;
  background: transparent;
  color: inherit;
  display: flex;
  align-items: center;
  gap: var(--space-2);
  cursor: pointer;
  font: inherit;
  text-align: left;
}
.tool-activity-row:hover,
.tool-activity--open .tool-activity-row { background: var(--hover-bg); }
.tool-chevron { flex: none; transition: transform 0.16s ease; }
.tool-chevron--open { transform: rotate(90deg); }
.tool-icon { flex: none; color: var(--accent); }
.tool-icon--spinning { animation: tool-spin 1.1s linear infinite; }
.tool-name { flex: none; color: var(--text-primary); font-family: 'Cascadia Code', Consolas, monospace; }
.tool-path { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--text-secondary); font-family: 'Cascadia Code', Consolas, monospace; }
.tool-state { margin-left: auto; flex: none; color: var(--text-faint); white-space: nowrap; }
.tool-diff-summary { flex: none; color: var(--text-secondary); white-space: nowrap; font-size: 11px; }
.tool-activity--running .tool-name,
.tool-activity--running .tool-state { color: #d9a93f; }
.tool-activity--error .tool-icon,
.tool-activity--error .tool-name,
.tool-activity--error .tool-state { color: #ef6b73; }
.tool-detail { border-top: 1px solid var(--glass-border); background: var(--tool-code-surface); }
.tool-detail-section + .tool-detail-section { border-top: 1px solid var(--glass-border); }
.tool-detail-label { display: block; padding: 6px var(--space-3); color: var(--text-faint); font-size: 11px; }
.tool-code { margin: 0; padding: 0 var(--space-3) var(--space-3); max-height: 240px; overflow: auto; white-space: pre-wrap; word-break: break-word; color: var(--text-secondary); font: 12px/1.55 'Cascadia Code', Consolas, monospace; }
.tool-result { color: var(--text-primary); }
.tool-detail :deep(.diff-view) { margin: 0 var(--space-3) var(--space-3); }
@keyframes tool-spin { to { transform: rotate(360deg); } }
</style>
