<script setup lang="ts">
import ToolCallCard from './ToolCallCard.vue'
import type { ToolCall } from '@/types'

// Legacy compatibility for callers that only have tool calls. New assistant turns use TurnTimeline.
defineProps<{ calls: ToolCall[] }>()
</script>

<template>
  <div class="tool-log">
    <ToolCallCard v-for="call in calls" :key="call.id" :call="call" />
  </div>
</template>

<style scoped>
.tool-log {
  display: flex;
  flex-direction: column;
}
</style>
