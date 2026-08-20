<script setup lang="ts">
import { Icon } from '@iconify/vue'

export interface AddMenuAction {
  key: string
  label: string
  description?: string
  icon: string
}

export interface PluginItem {
  key: string
  name: string
  description: string
  icon: string
  iconBg?: string
  iconColor?: string
}

withDefaults(defineProps<{
  actions?: AddMenuAction[]
  plugins?: PluginItem[]
}>(), {
  actions: () => [],
  plugins: () => []
})

const emit = defineEmits<{
  (e: 'selectAction', key: string): void
  (e: 'selectPlugin', key: string): void
}>()
</script>

<template>
  <div class="add-menu">
    <div v-if="actions.length" class="menu-section">
      <div class="menu-caption">添加</div>
      <button
        v-for="item in actions"
        :key="item.key"
        type="button"
        class="menu-row"
        @mousedown.prevent="emit('selectAction', item.key)"
      >
        <span class="row-icon" :class="`row-icon--${item.key}`">
          <Icon :icon="item.icon" width="16" />
        </span>
        <span class="row-label">{{ item.label }}</span>
        <span v-if="item.description" class="row-desc">{{ item.description }}</span>
      </button>
    </div>

    <div v-if="plugins.length" class="menu-section">
      <div class="menu-caption">插件</div>
      <button
        v-for="item in plugins"
        :key="item.key"
        type="button"
        class="menu-row menu-row--plugin"
        @mousedown.prevent="emit('selectPlugin', item.key)"
      >
        <span class="plugin-icon" :style="{ background: item.iconBg || 'var(--panel-bg)', color: item.iconColor || 'var(--text-secondary)' }">
          <Icon :icon="item.icon" width="16" />
        </span>
        <span class="plugin-name">{{ item.name }}</span>
        <span class="plugin-desc">{{ item.description }}</span>
      </button>
    </div>

    <slot />
  </div>
</template>

<style scoped>
.add-menu {
  position: absolute;
  left: 12px;
  right: 12px;
  bottom: calc(100% + 8px);
  z-index: 6;
  max-height: 360px;
  overflow: auto;
  padding: 8px 6px;
  border: 1px solid var(--glass-border);
  border-radius: 14px;
  background: color-mix(in srgb, var(--surface-bg) 96%, transparent);
  backdrop-filter: blur(16px);
  box-shadow: 0 16px 40px rgba(0, 0, 0, 0.14);
}

.add-menu::-webkit-scrollbar { width: 6px; }
.add-menu::-webkit-scrollbar-thumb {
  background: color-mix(in srgb, var(--text-faint) 30%, transparent);
  border-radius: 3px;
}

.menu-section {
  display: flex;
  flex-direction: column;
}

.menu-section + .menu-section {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid var(--glass-border);
}

.menu-caption {
  padding: 6px 8px 4px;
  color: var(--text-faint);
  font-size: 12px;
  font-weight: 500;
}

.menu-row {
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
  color: var(--text-primary);
}

.menu-row:hover {
  background: var(--hover-bg);
}

.row-icon {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  flex: 0 0 auto;
  border-radius: 6px;
  background: var(--panel-bg);
  border: 1px solid var(--glass-border);
  color: var(--text-secondary);
}

.row-label {
  flex: 0 0 auto;
  font-size: 13px;
  font-weight: 500;
}

.row-desc {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--text-faint);
  font-size: 12px;
}

.menu-row--plugin {
  gap: 10px;
}

.plugin-icon {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  flex: 0 0 auto;
  border-radius: 6px;
  border: 1px solid var(--glass-border);
  font-size: 14px;
}

.plugin-name {
  flex: 0 0 auto;
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary);
}

.plugin-desc {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--text-faint);
  font-size: 12px;
}
</style>
