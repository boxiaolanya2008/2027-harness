<script setup lang="ts">
import type { SkillSummary } from '@/types'
import { Icon } from '@iconify/vue'

defineProps<{
  items: SkillSummary[]
  activeIndex: number
  emptyText?: string
  showRenameHeader?: boolean
}>()

const emit = defineEmits<{
  (event: 'select', name: string): void
  (event: 'hover', index: number): void
  (event: 'rename'): void
}>()
</script>

<template>
  <div class="skill-autocomplete">
    <div v-if="showRenameHeader" class="skill-header">
      <button type="button" class="rename-left" @mousedown.prevent="emit('rename')">
        <Icon icon="mdi:pencil-outline" width="15" />
        <span>重命名</span>
      </button>
      <span class="rename-pill">重命名当前聊天</span>
    </div>
    <div v-if="showRenameHeader" class="skill-caption">技能</div>
    <div v-if="!items.length" class="skill-empty">{{ emptyText || '暂无匹配的技能' }}</div>
    <button
      v-for="(item, index) in items"
      :key="item.name"
      type="button"
      class="skill-item"
      :class="{ active: index === activeIndex }"
      @mouseenter="emit('hover', index)"
      @mousedown.prevent="emit('select', item.name)"
    >
      <span class="skill-icon"><Icon icon="mdi:cube-outline" width="16" /></span>
      <span class="skill-name">{{ item.name }}</span>
      <span class="skill-desc">{{ item.description || '—' }}</span>
      <span class="skill-scope">{{ (item as any).scope === 'system' ? '系统' : (item as any).scope ? '个人' : '个人' }}</span>
    </button>
  </div>
</template>

<style scoped>
.skill-autocomplete {
  position: absolute;
  left: var(--space-3);
  right: var(--space-3);
  bottom: calc(100% + 8px);
  z-index: 5;
  max-height: 360px;
  overflow: auto;
  padding: 6px;
  border: 1px solid var(--glass-border);
  border-radius: 14px;
  background: color-mix(in srgb, var(--surface-bg) 96%, transparent);
  backdrop-filter: blur(16px);
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.18);
}
.skill-autocomplete::-webkit-scrollbar { width: 6px; }
.skill-autocomplete::-webkit-scrollbar-thumb {
  background: color-mix(in srgb, var(--text-faint) 30%, transparent);
  border-radius: 3px;
}
.skill-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 4px 4px 8px;
  border-bottom: 1px solid var(--glass-border);
  margin-bottom: 6px;
}
.rename-left {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  border: 0;
  border-radius: 8px;
  background: var(--panel-bg);
  color: var(--text-primary);
  font-size: 13px;
  cursor: pointer;
}
.rename-left:hover { background: var(--hover-bg); }
.rename-pill {
  padding: 4px 10px;
  border-radius: 999px;
  background: var(--panel-bg);
  border: 1px solid var(--glass-border);
  color: var(--text-secondary);
  font-size: 11px;
  white-space: nowrap;
}
.skill-caption {
  padding: 6px 8px 4px;
  color: var(--text-faint);
  font-size: 12px;
  font-weight: 500;
}
.skill-empty {
  padding: 10px 8px;
  color: var(--text-secondary);
  font-size: 12px;
  line-height: 1.5;
}
.skill-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 8px 8px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--text-primary);
  text-align: left;
  cursor: pointer;
  min-width: 0;
}
.skill-item:hover,
.skill-item.active {
  background: var(--hover-bg);
}
.skill-icon {
  display: grid;
  place-items: center;
  width: 22px;
  height: 22px;
  flex: 0 0 auto;
  color: var(--text-secondary);
}
.skill-name {
  flex: 0 0 auto;
  font-size: 13px;
  font-weight: 600;
  white-space: nowrap;
}
.skill-desc {
  flex: 1;
  min-width: 0;
  color: var(--text-faint);
  font-size: 12px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.skill-scope {
  flex: 0 0 auto;
  color: var(--text-faint);
  font-size: 11px;
  white-space: nowrap;
}
</style>
