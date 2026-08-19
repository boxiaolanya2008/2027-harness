<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Icon } from '@iconify/vue'
import FileDiffView from './FileDiffView.vue'
import { getDiffStats } from '@/utils/fileDiff'
import { fileIcon } from '@/utils/fileIcon'
import type { FileEditPreview, ToolCall } from '@/types'

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
  liveOutput?: string
  fileEditPreview?: FileEditPreview
}>(), {
  rawArgs: undefined,
  result: undefined,
  liveOutput: undefined,
  fileEditPreview: undefined
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
const isFileEdit = computed(() => ['write_file', 'incrementally_edit'].includes(props.call.name))
const isListDir = computed(() => props.call.name === 'list_dir')
const filePath = computed(() => typeof props.call.args?.path === 'string' ? props.call.args.path : '')
const showResult = computed(() => (props.call.name === 'run_command' || !isListDir.value) && (props.call.name === 'run_command' || state.value === 'error'))
const displayedOutput = computed(() => state.value === 'running' && props.liveOutput !== undefined ? props.liveOutput : output.value)
const writeStateLabel = computed(() => {
  if (!isFileEdit.value) return stateLabel.value
  if (state.value === 'running') return diffSnapshot.value?.preview ? '准备写入' : '写入中'
  return stateLabel.value
})

watch(() => props.liveOutput, (chunk) => {
  if (chunk && props.call.name === 'run_command') open.value = true
})

const parsedDirectoryItems = computed(() => {
  if (!isListDir.value || !output.value) return []
  return output.value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const isDir = line.startsWith('[d]')
      const isFile = line.startsWith('[f]')
      const name = (isDir || isFile) ? line.slice(3).trim() : line
      return { isDir, name, icon: fileIcon(name, isDir) }
    })
})

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
  if (!isFileEdit.value) return undefined
  const snapshot = parseSnapshot(output.value)
  if (snapshot) {
    const content = asText(props.call.args?.content)
    return { ...snapshot, path: snapshot.path || filePath.value, after: snapshot.after ?? content, preview: false }
  }
  const preview = props.fileEditPreview
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
      <code v-if="isFileEdit && filePath" class="tool-path">{{ filePath }}</code>
      <code v-else-if="isListDir" class="tool-path">{{ (call.args?.path as string) || '.' }}</code>
      <span class="tool-state">{{ writeStateLabel }}</span>
      <span v-if="diffStats" class="tool-diff-summary">
        <span class="diff-add">+{{ diffStats.additions }}</span>
        <span class="diff-del">−{{ diffStats.deletions }}</span>
      </span>
    </button>

    <div v-if="open" class="tool-detail">
      <section v-if="!isFileEdit && !isListDir" class="tool-detail-section">
        <span class="tool-detail-label">参数</span>
        <pre class="tool-code">{{ rawArguments }}</pre>
      </section>

      <section v-if="isListDir && parsedDirectoryItems.length" class="tool-detail-section">
        <div class="dir-view">
          <div class="dir-summary">
            <span>{{ parsedDirectoryItems.filter(i => i.isDir).length }} 目录</span>
            <span>{{ parsedDirectoryItems.filter(i => !i.isDir).length }} 文件</span>
          </div>
          <div class="dir-grid">
            <div v-for="item in parsedDirectoryItems" :key="item.name" class="dir-item" :class="{ 'dir-item--dir': item.isDir }">
              <Icon :icon="item.icon" width="15" />
              <span>{{ item.name }}</span>
            </div>
          </div>
        </div>
      </section>

      <section v-if="diffSnapshot" class="tool-detail-section tool-detail-section--diff">
        <FileDiffView
          :before="diffSnapshot.before"
          :after="diffSnapshot.after"
          :path="diffSnapshot.path"
          :operation="diffSnapshot.operation"
          :hide-header="true"
        />
      </section>
      <section v-if="showResult && displayedOutput !== undefined" class="tool-detail-section">
        <span class="tool-detail-label">{{ state === 'running' ? '实时输出' : state === 'error' ? '错误详情' : '工具结果' }}</span>
        <pre class="tool-code tool-result" :class="{ 'tool-result--live': state === 'running' }">{{ displayedOutput || '等待输出…' }}</pre>
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
.tool-diff-summary { display: inline-flex; align-items: center; gap: 6px; flex: none; font-size: 11px; font-weight: 500; font-family: 'Cascadia Code', Consolas, monospace; }
.diff-add { color: var(--diff-add); }
.diff-del { color: var(--diff-remove); }
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
.tool-detail :deep(.diff-view) { margin: 0; border: 0; }
.dir-view { padding: var(--space-2) var(--space-3) var(--space-3); }
.dir-summary { display: flex; gap: var(--space-3); margin-bottom: var(--space-2); color: var(--text-faint); font-size: 11px; }
.dir-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 6px; }
.dir-item { display: flex; align-items: center; gap: 6px; padding: 5px 8px; border: 1px solid var(--glass-border); border-radius: var(--radius-sm); background: var(--surface-bg); color: var(--text-secondary); font-size: 12px; font-family: 'Cascadia Code', Consolas, monospace; }
.dir-item--dir { color: var(--text-primary); font-weight: 500; }
.dir-item svg { flex: none; color: var(--accent); }
.dir-item:not(.dir-item--dir) svg { color: var(--text-faint); }
@keyframes tool-spin { to { transform: rotate(360deg); } }
</style>
