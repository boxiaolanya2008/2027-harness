<script setup lang="ts">
import { Icon } from '@iconify/vue'
import type { ComposerMode } from '@/types'

defineProps<{
  modelValue: ComposerMode
}>()
const emit = defineEmits<{
  (e: 'update:modelValue', v: ComposerMode): void
}>()

const modes: Array<{ value: ComposerMode; label: string; icon: string }> = [
  { value: 'coding', label: '编码', icon: 'mdi:code-tags' },
  { value: 'thinking', label: '思考', icon: 'mdi:head-snowflake-outline' },
  { value: 'security', label: '安全', icon: 'mdi:shield-outline' }
]
</script>

<template>
  <div class="mode-selector">
    <button
      v-for="m in modes"
      :key="m.value"
      type="button"
      class="mode-btn"
      :class="{ active: modelValue === m.value }"
      @click="emit('update:modelValue', m.value)"
    >
      <Icon :icon="m.icon" width="14" />
      <span>{{ m.label }}</span>
    </button>
  </div>
</template>

<style scoped>
.mode-selector {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 2px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--panel-bg) 85%, transparent);
  border: 1px solid color-mix(in srgb, var(--glass-border) 60%, transparent);
  backdrop-filter: blur(8px);
}
.mode-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 5px 10px;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: var(--text-secondary);
  font-size: 12px;
  cursor: pointer;
  transition: all 0.15s ease;
}
.mode-btn:hover { color: var(--text-primary); background: color-mix(in srgb, var(--surface-bg) 70%, transparent); }
.mode-btn.active {
  background: var(--surface-bg);
  color: var(--text-primary);
  box-shadow: 0 1px 4px rgba(0,0,0,0.08);
  border: 1px solid var(--glass-border);
}
</style>
