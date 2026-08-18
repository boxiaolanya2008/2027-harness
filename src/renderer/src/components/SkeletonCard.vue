<script setup lang="ts">
defineProps<{
  rows?: number
  avatar?: boolean
}>()
</script>

<template>
  <div class="skeleton">
    <div v-for="i in rows || 3" :key="i" class="skeleton-row">
      <div v-if="avatar" class="skeleton-avatar shimmer" />
      <div class="skeleton-lines">
        <div class="skeleton-line shimmer" :style="{ width: `${90 - i * 12}%` }" />
        <div class="skeleton-line short shimmer" :style="{ width: `${50 - i * 8}%` }" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.skeleton {
  padding: var(--space-4);
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}
.skeleton-row {
  display: flex;
  gap: var(--space-3);
}
.skeleton-avatar {
  width: 36px;
  height: 36px;
  border-radius: var(--radius-sm);
  flex-shrink: 0;
}
.skeleton-lines {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}
.skeleton-line {
  height: 12px;
  border-radius: 6px;
}
.skeleton-line.short {
  height: 10px;
}
.shimmer {
  background: linear-gradient(90deg, rgba(255,255,255,.05) 25%, rgba(255,255,255,.12) 50%, rgba(255,255,255,.05) 75%);
  background-size: 200% 100%;
  animation: shimmer 1.4s infinite;
}
@keyframes shimmer {
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
}
</style>
