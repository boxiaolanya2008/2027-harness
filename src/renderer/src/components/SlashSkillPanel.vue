<script setup lang="ts">
import { Icon } from '@iconify/vue'

export interface SkillPanelItem {
  key: string
  name: string
  description?: string
  scope?: 'personal' | 'system' | string
  icon?: string
}

withDefaults(defineProps<{
  items: SkillPanelItem[]
  activeIndex: number
  emptyText?: string
  showRename?: boolean
}>(), {
  emptyText: '暂无匹配的技能',
  showRename: true
})

const emit = defineEmits<{
  (e: 'select', key: string): void
  (e: 'hover', index: number): void
  (e: 'rename'): void
}>()
</script>

<template>
  <div class="slash-panel">
    <div v-if="showRename" class="panel-header">
      <button type="button" class="rename-left" @mousedown.prevent="emit('rename')">
        <Icon icon="mdi:pencil-outline" width="15" />
        <span>重命名</span>
      </button>
      <span class="rename-pill">重命名当前聊天</span>
    </div>

    <div class="panel-caption">技能</div>

    <div v-if="!items.length" class="skill-empty">{{ emptyText }}</div>

    <button
      v-for="(item, index) in items"
      :key="item.key"
      type="button"
      class="skill-row"
      :class="{ active: index === activeIndex }"
      @mouseenter="emit('hover', index)"
      @mousedown.prevent="emit('select', item.key)"
    >
      <span class="skill-icon">
        <Icon :icon="item.icon || 'mdi:cube-outline'" width="16" />
      </span>
      <span class="skill-name">{{ item.name }}</span>
      <span class="skill-desc">{{ item.description || '' }}</span>
      <span v-if="item.scope" class="skill-scope">{{ item.scope === 'personal' ? '个人' : item.scope === 'system' ? '系统' : item.scope }}</span>
    </button>
  </div>
</template>

<style scoped>
.slash-panel {
  position: absolute;
  left: 12px;
  right: 12px;
  bottom: calc(100% + 8px);
  z-index: 6;
  max-height: 360px;
  overflow: auto;
  padding: 6px;
  border: 1px solid var(--glass-border);
  border-radius: 14px;
  background: color-mix(in srgb, var(--surface-bg) 96%, transparent);
  backdrop-filter: blur(16px);
  box-shadow: 0 16px 40px rgba(0, 0, 0, 0.14);
}
.slash-panel::-webkit-scrollbar { width: 6px; }
.slash-panel::-webkit-scrollbar-thumb {
  background: color-mix(in srgb, var(--text-faint) 30%, transparent);
  border-radius: 3px;
}

.panel-header {
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

.rename-left:hover {
  background: var(--hover-bg);
}

.rename-pill {
  padding: 4px 10px;
  border-radius: 999px;
  background: var(--panel-bg);
  border: 1px solid var(--glass-border);
  color: var(--text-secondary);
  font-size: 11px;
  white-space: nowrap;
}

.panel-caption {
  padding: 6px 8px 4px;
  color: var(--text-faint);
  font-size: 12px;
  font-weight: 500;
}

.skill-empty {
  padding: 10px 8px;
  color: var(--text-secondary);
  font-size: 12px;
}

.skill-row {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 8px 8px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  text-align: left;
  cursor: pointer;
  min-width: 0;
}

.skill-row:hover,
.skill-row.active {
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
  color: var(--text-primary);
  white-space: nowrap;
}

.skill-desc {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--text-faint);
  font-size: 12px;
}

.skill-scope {
  flex: 0 0 auto;
  color: var(--text-faint);
  font-size: 11px;
  white-space: nowrap;
}
</style>
