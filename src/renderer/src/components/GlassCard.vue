<script setup lang="ts">
defineProps<{
  interactive?: boolean
}>()
</script>

<template>
  <div class="glass-card" :class="{ 'glass-card--interactive': interactive !== false }">
    <slot />
  </div>
</template>

<style scoped>
.glass-card {
  background: var(--glass-bg);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
  backdrop-filter: var(--glass-blur);
  -webkit-backdrop-filter: var(--glass-blur);
  transition:
    transform 0.22s ease,
    box-shadow 0.22s ease,
    border-color 0.22s ease;
}
.glass-card--interactive:hover {
  transform: translateY(-3px);
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.45);
  border-color: rgba(255, 255, 255, 0.22);
}
</style>
