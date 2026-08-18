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
.timeline {
  display: flex;
  flex-direction: column;
}
.tl-item {
  display: flex;
  gap: var(--space-3);
}
.tl-rail {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 24px;
  flex-shrink: 0;
}
.tl-dot {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #0b0e14;
  box-shadow: 0 0 0 4px rgba(255, 255, 255, 0.06);
}
.tl-line {
  flex: 1;
  width: 2px;
  background: rgba(255, 255, 255, 0.1);
}
.tl-body {
  padding-bottom: var(--space-5);
}
.tl-time {
  font-size: 12px;
  color: var(--text-faint);
}
.tl-title {
  font-size: 13px;
  color: var(--text-primary);
  margin-top: var(--space-1);
}
.tl-subtitle {
  font-size: 12px;
  color: var(--text-secondary);
  margin-top: var(--space-1);
}
</style>
