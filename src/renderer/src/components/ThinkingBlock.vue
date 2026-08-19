<script setup lang="ts">
import { computed, ref } from 'vue'
import { Icon } from '@iconify/vue'
import MarkdownView from './MarkdownView.vue'

const props = withDefaults(defineProps<{
  content: string
  streaming?: boolean
  status?: string
}>(), {
  streaming: false,
  status: ''
})

const open = ref(true)
const label = computed(() => {
  if (props.status === 'error') return '模型思考中断'
  return props.streaming ? '模型思考中' : '模型思考'
})

</script>

<template>
  <section class="thinking" :class="{ 'thinking--streaming': streaming, 'thinking--error': status === 'error' }">
    <button class="thinking-toggle" type="button" :aria-expanded="open" @click="open = !open">
      <Icon class="thinking-chevron" :class="{ 'thinking-chevron--open': open }" icon="mdi:chevron-right" width="18" />
      <Icon :icon="streaming ? 'mdi:loading' : status === 'error' ? 'mdi:alert-circle-outline' : 'mdi:head-snowflake-outline'" width="16" />
      <span>{{ label }}</span>
      <span v-if="streaming" class="thinking-live">实时</span>
    </button>
    <div v-if="open" class="thinking-content">
      <MarkdownView :content="content" :streaming="streaming" />
    </div>
  </section>
</template>

<style scoped>
.thinking {
  margin: var(--space-2) 0;
  border-left: 2px solid var(--glass-border);
  color: var(--text-secondary);
}
.thinking--streaming {
  border-left-color: var(--accent);
}
.thinking--error {
  border-left-color: #ef6b73;
}
.thinking-toggle {
  width: 100%;
  padding: var(--space-2) var(--space-3);
  border: 0;
  background: transparent;
  color: inherit;
  display: flex;
  align-items: center;
  gap: var(--space-2);
  text-align: left;
  cursor: pointer;
  font: inherit;
  font-size: 12px;
}
.thinking-toggle:hover {
  background: var(--hover-bg);
}
.thinking-chevron {
  transition: transform 0.16s ease;
}
.thinking-chevron--open {
  transform: rotate(90deg);
}
.thinking-live {
  margin-left: auto;
  color: var(--accent);
  font-size: 11px;
}
.thinking-content {
  padding: 0 var(--space-3) var(--space-3) calc(var(--space-3) + 26px);
  color: var(--text-secondary);
}
</style>
