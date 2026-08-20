<script setup lang="ts">
import { ref } from 'vue'
import { Icon } from '@iconify/vue'

export interface ToolCommandItem {
  id: string
  command: string
  status?: 'running' | 'done' | 'error'
}

const props = withDefaults(defineProps<{
  commands: ToolCommandItem[]
  defaultOpen?: boolean
}>(), {
  defaultOpen: true
})

const open = ref(props.defaultOpen)
const emit = defineEmits<{
  (e: 'select', id: string): void
}>()
</script>

<template>
  <div class="tool-group">
    <button type="button" class="group-header" @click="open = !open">
      <Icon icon="mdi:console-line" width="14" class="header-icon" />
      <span class="header-title">运行了命令</span>
      <span class="header-count">({{ commands.length }})</span>
      <Icon icon="mdi:chevron-right" width="16" class="header-chevron" :class="{ open }" />
    </button>
    <div v-show="open" class="group-list">
      <button
        v-for="c in commands"
        :key="c.id"
        type="button"
        class="tool-row"
        @click="emit('select', c.id)"
      >
        <Icon icon="mdi:console" width="14" class="row-icon" />
        <span class="row-label">已运行</span>
        <span class="row-cmd" :title="c.command">{{ c.command }}</span>
        <Icon icon="mdi:chevron-right" width="14" class="row-arrow" />
      </button>
    </div>
  </div>
</template>

<style scoped>
.tool-group {
  border: 1px solid #e6eef3; border-radius: 8px; background: #fff; overflow: hidden; margin: 8px 0;
}
.group-header {
  display: flex; align-items: center; gap: 6px; width: 100%; padding: 8px 10px;
  border: 0; background: #f8fafc; color: #334155; font-size: 12px; font-weight: 600; cursor: pointer; text-align: left;
}
.group-header:hover { background: #f1f5f9; }
.header-chevron { transition: transform 0.16s ease; color: #64748b; margin-left: auto; }
.header-chevron.open { transform: rotate(90deg); }
.header-icon { color: #64748b; }
.header-title { flex: 0 0 auto; }
.header-count { color: #94a3b8; font-weight: 400; font-size: 11px; }
.group-list { display: flex; flex-direction: column; }
.tool-row {
  display: flex; align-items: center; gap: 6px; width: 100%; padding: 8px 10px;
  border: 0; border-top: 1px solid #f1f5f9; background: #fff; color: #475569; font-size: 12px; text-align: left; cursor: pointer;
  font-family: 'Cascadia Code', Consolas, monospace;
}
.tool-row:first-child { border-top: 0; }
.tool-row:hover { background: #f8fafc; color: #0f172a; }
.row-icon { flex: 0 0 auto; color: #64748b; }
.row-label { flex: 0 0 auto; color: #64748b; font-size: 12px; }
.row-cmd {
  flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  color: #334155; font-size: 12px;
}
.row-arrow { flex: 0 0 auto; color: #94a3b8; }
</style>
