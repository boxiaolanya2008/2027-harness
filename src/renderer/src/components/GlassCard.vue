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
}
.glass-card--interactive {
  transition:
    transform 0.22s ease,
    box-shadow 0.22s ease,
    border-color 0.22s ease;
}
.glass-card--interactive:hover {
  transform: translateY(-2px);
  border-color: color-mix(in srgb, var(--accent) 28%, var(--glass-border));
  box-shadow: 0 10px 24px color-mix(in srgb, var(--text-primary) 12%, transparent);
}
</style>
