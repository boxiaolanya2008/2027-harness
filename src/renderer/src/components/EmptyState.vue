<script setup lang="ts">
defineProps<{
  title: string
  desc?: string
  action?: string
}>()
</script>

<template>
  <div class="empty">
    <p class="empty-title">{{ title }}</p>
    <p v-if="desc" class="empty-desc">{{ desc }}</p>
    <slot />
  </div>
</template>

<style scoped>
.empty {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: center;
  padding: 18px 12px;
}
.empty-title {
  margin: 0;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
}
.empty-desc {
  margin: 6px 0 0;
  max-width: 100%;
  color: var(--text-secondary);
  font-size: 12px;
  line-height: 1.45;
}
</style>
