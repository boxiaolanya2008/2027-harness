<script setup lang="ts">
import { Icon } from '@iconify/vue'

defineProps<{
  model: string
  reasoningLabel: string
}>()
defineEmits<{
  (e: 'selectModel'): void
  (e: 'selectReasoning'): void
}>()
</script>

<template>
  <div class="model-popover">
    <button type="button" class="model-row" @mousedown.prevent="$emit('selectModel')">
      <span class="row-label">模型</span>
      <span class="row-value" :title="model">{{ model }}</span>
      <Icon icon="mdi:chevron-right" width="18" class="row-arrow" />
    </button>
    <button type="button" class="model-row" @mousedown.prevent="$emit('selectReasoning')">
      <span class="row-label">推理强度</span>
      <span class="row-value row-value--center" :title="reasoningLabel">{{ reasoningLabel }}</span>
      <Icon icon="mdi:chevron-right" width="18" class="row-arrow" />
    </button>
  </div>
</template>

<style scoped>
.model-popover {
  position: absolute;
  right: 0;
  bottom: calc(100% + 8px);
  z-index: 18;
  width: 280px;
  padding: 6px;
  border: 1px solid var(--glass-border);
  border-radius: 12px;
  background: var(--surface-bg);
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.18), 0 2px 8px rgba(0, 0, 0, 0.08);
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.model-row {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 10px 10px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  text-align: left;
  cursor: pointer;
}
.model-row:hover {
  background: var(--hover-bg);
}
.row-label {
  flex: 0 0 64px;
  font-size: 13px;
  color: var(--text-primary);
  font-weight: 500;
}
.row-value {
  flex: 1;
  min-width: 0;
  font-size: 13px;
  color: var(--text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-align: right;
}
.row-value--center { text-align: center; }
.row-arrow {
  flex: 0 0 auto;
  color: var(--text-faint);
}
</style>
