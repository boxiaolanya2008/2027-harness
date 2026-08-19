<script setup lang="ts">
import { computed, ref } from 'vue'
import { Icon } from '@iconify/vue'
import FileDiffView from './FileDiffView.vue'
import type { ToolCall } from '@/types'

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
}>(), {
  rawArgs: undefined,
  result: undefined
})

const detailsOpen = ref(false)
const resultOpen = ref(false)
const diffOpen = ref(false)
const rawArguments = computed(() => {
  if (props.rawArgs !== undefined) return props.rawArgs
  const args = props.call.args
  if (typeof args === 'string') return args
  try {
    return JSON.stringify(args ?? {}, null, 2)
  } catch {
    return String(args)
  }
})
const output = computed(() => props.result ?? props.call.result)
const state = computed(() => props.call.status || 'running')
const stateLabel = computed(() => ({ running: '运行中', done: '已完成', error: '失败' }[state.value] || state.value))
const stateIcon = computed(() => ({ running: 'mdi:loading', done: 'mdi:check-circle', error: 'mdi:alert-circle' }[state.value] || 'mdi:tools'))

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

function getSnapshot(value: unknown): FileSnapshot | undefined {
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
  const operation = asText(data.operation ?? data.action ?? data.type) || (before == null ? 'create' : 'update')
  return { before: before ?? null, after: after ?? null, path: asText(path) || '', operation }
}

function parseSnapshot(raw: string | undefined): FileSnapshot | undefined {
  if (!raw?.trim()) return undefined
  try {
    const parsed: unknown = JSON.parse(raw)
    const direct = getSnapshot(parsed)
    if (direct) return direct
    if (parsed && typeof parsed === 'object') {
      const wrapped = parsed as Record<string, unknown>
      for (const key of ['snapshot', 'fileSnapshot', 'file', 'data']) {
        const nested = getSnapshot(wrapped[key])
        if (nested) return nested
      }
    }
  } catch {
    // Ordinary tool output remains visible in the result panel.
  }
  return undefined
}

const diffSnapshot = computed(() => {
  if (props.call.name !== 'write_file' || state.value === 'error') return undefined
  const snapshot = parseSnapshot(output.value)
  if (!snapshot) return undefined
  const args = props.call.args || {}
  return {
    ...snapshot,
    path: snapshot.path || asText(args.path) || '',
    after: snapshot.after ?? asText(args.content)
  }
})
</script>

<template>
  <article class="tool-card" :class="`tool-card--${state}`">
    <header class="tool-head">
      <Icon class="tool-icon" :class="{ 'tool-icon--spinning': state === 'running' }" :icon="stateIcon" width="17" />
      <code class="tool-name">{{ call.name || 'unknown_tool' }}</code>
      <span class="tool-state">{{ stateLabel }}</span>
    </header>

    <button class="tool-toggle" type="button" :aria-expanded="detailsOpen" @click="detailsOpen = !detailsOpen">
      <Icon :class="{ 'tool-toggle-icon--open': detailsOpen }" icon="mdi:chevron-right" width="16" />
      原始参数
    </button>
    <pre v-if="detailsOpen" class="tool-code">{{ rawArguments }}</pre>

    <template v-if="output !== undefined">
      <button class="tool-toggle" type="button" :aria-expanded="resultOpen" @click="resultOpen = !resultOpen">
        <Icon :class="{ 'tool-toggle-icon--open': resultOpen }" icon="mdi:chevron-right" width="16" />
        {{ state === 'error' ? '错误详情' : '工具结果' }}
      </button>
      <pre v-if="resultOpen" class="tool-code tool-result">{{ output }}</pre>
      <button
        v-if="diffSnapshot"
        class="tool-toggle tool-diff-toggle"
        type="button"
        :aria-expanded="diffOpen"
        @click="diffOpen = !diffOpen"
      >
        <Icon :class="{ 'tool-toggle-icon--open': diffOpen }" icon="mdi:chevron-right" width="16" />
        查看 Diff
      </button>
      <FileDiffView
        v-if="diffOpen && diffSnapshot"
        :before="diffSnapshot.before"
        :after="diffSnapshot.after"
        :path="diffSnapshot.path"
        :operation="diffSnapshot.operation"
      />
    </template>
  </article>
</template>

<style scoped>
.tool-card {
  margin: var(--space-2) 0;
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-sm);
  background: var(--hover-bg);
  overflow: hidden;
  font-size: 12px;
}
.tool-head {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
}
.tool-icon {
  color: var(--accent);
}
.tool-icon--spinning {
  animation: tool-spin 1.1s linear infinite;
}
.tool-name {
  color: var(--text-primary);
  font-family: 'Cascadia Code', Consolas, monospace;
}
.tool-state {
  margin-left: auto;
  color: var(--text-faint);
}
.tool-toggle {
  width: 100%;
  border: 0;
  border-top: 1px solid var(--glass-border);
  background: transparent;
  color: var(--text-secondary);
  padding: 6px var(--space-3);
  display: flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;
  text-align: left;
  font: inherit;
}
.tool-toggle:hover {
  background: rgba(255, 255, 255, 0.035);
}
.tool-diff-toggle {
  color: var(--accent);
}
.tool-toggle-icon--open {
  transform: rotate(90deg);
}
.tool-code {
  margin: 0;
  padding: var(--space-3);
  max-height: 240px;
  overflow: auto;
  white-space: pre-wrap;
  word-break: break-word;
  background: rgba(0, 0, 0, 0.2);
  color: var(--text-secondary);
  font-family: 'Cascadia Code', Consolas, monospace;
  font-size: 12px;
  line-height: 1.55;
}
.tool-card--running .tool-name,
.tool-card--running .tool-state {
  color: #d9a93f;
}
.tool-card--error .tool-icon,
.tool-card--error .tool-name,
.tool-card--error .tool-state {
  color: #ef6b73;
}
@keyframes tool-spin {
  to { transform: rotate(360deg); }
}
</style>
