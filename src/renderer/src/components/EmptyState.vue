<script setup lang="ts">
defineProps<{
  title: string
  desc?: string
  action?: string
}>()
</script>

<template>
  <div class="empty">
    <div class="empty-illus">
      <svg viewBox="0 0 120 120" width="88" height="88" fill="none">
        <circle cx="60" cy="60" r="46" stroke="rgba(110,168,255,.35)" stroke-width="2" stroke-dasharray="6 6" />
        <circle cx="60" cy="60" r="30" stroke="rgba(192,132,252,.4)" stroke-width="2" />
        <circle cx="60" cy="60" r="8" fill="rgba(110,168,255,.7)" />
        <path d="M60 14v10M60 96v10M14 60h10M96 60h10M27 27l7 7M86 86l7 7M93 27l-7 7M34 86l-7 7" stroke="rgba(255,255,255,.25)" stroke-width="2" stroke-linecap="round" />
      </svg>
    </div>
    <p class="empty-title">{{ title }}</p>
    <p v-if="desc" class="empty-desc">{{ desc }}</p>
    <slot />
  </div>
</template>

<style scoped>
.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--space-8) var(--space-5);
  text-align: center;
}
.empty-illus {
  opacity: 0.9;
  animation: floaty 3.5s ease-in-out infinite;
}
@keyframes floaty {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-6px);
  }
}
.empty-title {
  margin: var(--space-4) 0 var(--space-2);
  font-size: 15px;
  color: var(--text-primary);
}
.empty-desc {
  margin: 0;
  font-size: 13px;
  color: var(--text-secondary);
  max-width: 320px;
}
</style>
