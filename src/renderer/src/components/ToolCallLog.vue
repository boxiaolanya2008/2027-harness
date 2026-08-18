<script setup lang="ts">
import { Icon } from '@iconify/vue'
import type { ToolCall } from '@/types'

defineProps<{ calls: ToolCall[] }>()
</script>

<template>
  <div class="tool-log">
    <div v-for="c in calls" :key="c.id" class="tool-call" :class="`tool-call--${c.status}`">
      <div class="tool-head">
        <Icon
          :icon="c.status === 'running' ? 'eos-icons:loading' : c.status === 'error' ? 'mdi:alert-circle' : 'mdi:check-circle'"
          width="14"
        />
        <span class="tool-name">{{ c.name }}</span>
        <span class="tool-args">{{ JSON.stringify(c.args) }}</span>
      </div>
      <pre v-if="c.result" class="tool-result">{{ c.result }}</pre>
    </div>
  </div>
</template>

<style scoped>
.tool-log {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  margin: var(--space-2) 0;
}
.tool-call {
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-sm);
  background: rgba(255, 255, 255, 0.04);
  padding: var(--space-2) var(--space-3);
  font-size: 12px;
}
.tool-head {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  color: var(--text-secondary);
}
.tool-name {
  color: var(--accent);
  font-family: 'Cascadia Code', Consolas, monospace;
}
.tool-args {
  color: var(--text-faint);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.tool-result {
  margin: var(--space-2) 0 0;
  max-height: 160px;
  overflow: auto;
  white-space: pre-wrap;
  font-family: 'Cascadia Code', Consolas, monospace;
  color: var(--text-secondary);
}
.tool-call--running .tool-name {
  color: #ffd166;
}
</style>
