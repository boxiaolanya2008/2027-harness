<script setup lang="ts">
import { ref } from 'vue'
import { Icon } from '@iconify/vue'

defineProps<{
  trigger: string
  items: { key: string; label: string; icon?: string }[]
}>()
const emit = defineEmits<{ (e: 'select', key: string): void }>()

const visible = ref(false)
</script>

<template>
  <el-popover v-model:visible="visible" :width="180" trigger="click" popper-class="glass-popover">
    <template #reference>
      <el-button text class="pop-trigger">{{ trigger }}</el-button>
    </template>
    <div class="pop-items">
      <button
        v-for="it in items"
        :key="it.key"
        class="pop-item"
        @click="visible = false; emit('select', it.key)"
      >
        <Icon :icon="it.icon || 'mdi:dots-horizontal'" width="16" />
        <span>{{ it.label }}</span>
      </button>
    </div>
  </el-popover>
</template>

<style>
.glass-popover {
  background: rgba(20, 24, 34, 0.92) !important;
  backdrop-filter: blur(16px);
  border: 1px solid var(--glass-border) !important;
  border-radius: var(--radius-md) !important;
  padding: var(--space-2) !important;
}
.glass-popover .el-popper__arrow::before {
  background: rgba(20, 24, 34, 0.92) !important;
  border-color: var(--glass-border) !important;
}
</style>

<style scoped>
.pop-trigger {
  color: var(--text-secondary);
}
.pop-items {
  display: flex;
  flex-direction: column;
}
.pop-item {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  border: none;
  background: transparent;
  color: var(--text-primary);
  font-size: 13px;
  border-radius: var(--radius-sm);
  cursor: pointer;
}
.pop-item:hover {
  background: var(--hover-bg);
}
</style>
