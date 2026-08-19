<script setup lang="ts">
import dayjs from 'dayjs'
import { Icon } from '@iconify/vue'

export interface TimelineNode {
  id: string
  title: string
  subtitle?: string
  time: string
  icon?: string
  accent?: string
}

defineProps<{
  nodes: TimelineNode[]
}>()
</script>

<template>
  <div class="timeline">
    <div v-for="(n, i) in nodes" :key="n.id" class="tl-item">
      <div class="tl-rail">
        <div class="tl-dot" :style="{ background: n.accent || 'var(--accent)' }">
          <Icon v-if="n.icon" :icon="n.icon" width="14" />
        </div>
        <div v-if="i < nodes.length - 1" class="tl-line" />
      </div>
      <div class="tl-body">
        <div class="tl-time">{{ dayjs(n.time).format('MM-DD HH:mm') }}</div>
        <div class="tl-title">{{ n.title }}</div>
        <div v-if="n.subtitle" class="tl-subtitle">{{ n.subtitle }}</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.timeline { display: flex; flex-direction: column; padding: 8px 4px 0; }
.tl-item { display: flex; gap: 12px; }
.tl-rail { display: flex; flex-direction: column; align-items: center; width: 24px; flex-shrink: 0; }
.tl-dot {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
}
.tl-line { flex: 1; width: 2px; background: var(--glass-border); }
.tl-body { padding-bottom: 16px; min-width: 0; }
.tl-time { font-size: 12px; color: var(--text-faint); }
.tl-title { font-size: 13px; color: var(--text-primary); margin-top: 4px; line-height: 1.4; }
.tl-subtitle { font-size: 12px; color: var(--text-secondary); margin-top: 4px; }
</style>
