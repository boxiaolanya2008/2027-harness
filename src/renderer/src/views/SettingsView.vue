<script setup lang="ts">
import { useRouter } from 'vue-router'
import SetupView from './SetupView.vue'

const router = useRouter()
</script>

<template>
  <div>
    <button class="back" @click="router.push('/')">← 返回</button>
    <SetupView />
  </div>
</template>

<style scoped>
.back {
  position: fixed;
  top: var(--space-4);
  left: var(--space-4);
  z-index: 10;
  background: transparent;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
}
</style>
