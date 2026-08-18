<script setup lang="ts">
import { computed, ref } from 'vue'
import { Icon } from '@iconify/vue'
import type { ToolCall } from '@/types'

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
