<script setup lang="ts">
import { nextTick, onMounted, onBeforeUnmount, ref, watch } from 'vue'
import { Icon } from '@iconify/vue'
import type { ComposerMode } from '@/types'

const props = defineProps<{
  modelValue: ComposerMode
}>()
const emit = defineEmits<{
  (e: 'update:modelValue', v: ComposerMode): void
}>()

const modes: Array<{ value: ComposerMode; label: string; icon: string }> = [
  { value: 'coding', label: '编码', icon: 'mdi:code-tags' },
  { value: 'thinking', label: '思考', icon: 'mdi:head-snowflake-outline' },
  { value: 'security', label: '安全', icon: 'mdi:shield-outline' }
]

const containerRef = ref<HTMLElement | null>(null)
const btnRefs = ref<HTMLElement[]>([])
const indicatorStyle = ref<Record<string, string>>({ opacity: '0' })

function setBtnRef(el: any, idx: number) {
  if (el) btnRefs.value[idx] = el as HTMLElement
}

function updateIndicator() {
  const idx = modes.findIndex(m => m.value === props.modelValue)
  const btn = btnRefs.value[idx]
  const container = containerRef.value
  if (!btn || !container) return
  const cRect = container.getBoundingClientRect()
  const bRect = btn.getBoundingClientRect()
  const left = bRect.left - cRect.left
  const width = bRect.width
  indicatorStyle.value = {
    transform: `translateX(${left}px)`,
    width: `${width}px`,
    opacity: '1'
  }
}

watch(() => props.modelValue, () => nextTick(updateIndicator))
onMounted(() => {
  nextTick(updateIndicator)
  window.addEventListener('resize', updateIndicator)
})
onBeforeUnmount(() => window.removeEventListener('resize', updateIndicator))
</script>

<template>
  <div ref="containerRef" class="mode-selector">
    <!-- 平滑移动的液态指示器 -->
    <div class="mode-indicator" :style="indicatorStyle">
      <span class="liquid-inner"></span>
    </div>
    <button
      v-for="(m, idx) in modes"
      :key="m.value"
      :ref="el => setBtnRef(el, idx)"
      type="button"
      class="mode-btn"
      :class="{ active: modelValue === m.value }"
      @click="emit('update:modelValue', m.value)"
    >
      <Icon :icon="m.icon" width="14" />
      <span>{{ m.label }}</span>
    </button>
  </div>
</template>

<style scoped>
.mode-selector {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 2px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--panel-bg) 88%, transparent);
  border: 1px solid color-mix(in srgb, var(--glass-border) 55%, transparent);
  backdrop-filter: blur(10px) saturate(1.4);
}

.mode-indicator {
  position: absolute;
  top: 2px;
  bottom: 2px;
  left: 0;
  border-radius: 999px;
  /* Transparent Liquid Glass */
  background: linear-gradient(135deg, color-mix(in srgb, var(--surface-bg) 92%, transparent), color-mix(in srgb, var(--surface-bg) 72%, transparent));
  backdrop-filter: blur(14px) saturate(1.6);
  -webkit-backdrop-filter: blur(14px) saturate(1.6);
  border: 1px solid color-mix(in srgb, rgba(255,255,255,0.65) 45%, var(--glass-border));
  box-shadow:
    0 2px 10px rgba(0,0,0,0.08),
    0 1px 3px rgba(0,0,0,0.06),
    inset 0 1px 1px rgba(255,255,255,0.7),
    inset 0 -1px 1px rgba(0,0,0,0.04);
  overflow: hidden;
  will-change: transform, width;
  transition: transform 0.42s cubic-bezier(0.34, 1.2, 0.64, 1), width 0.34s cubic-bezier(0.34, 1.2, 0.64, 1), opacity 0.18s ease;
  z-index: 0;
}
.liquid-inner {
  position: absolute;
  inset: -20% -40%;
  background: linear-gradient(120deg, transparent 30%, rgba(255,255,255,0.45) 48%, transparent 62%);
  transform: translateX(-100%) skewX(-12deg);
  animation: liquid-shine 3.2s ease-in-out infinite;
  pointer-events: none;
}
@keyframes liquid-shine {
  0% { transform: translateX(-100%) skewX(-12deg); }
  45% { transform: translateX(-100%) skewX(-12deg); }
  70% { transform: translateX(100%) skewX(-12deg); }
  100% { transform: translateX(100%) skewX(-12deg); }
}

.mode-btn {
  position: relative;
  z-index: 1;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 5px 10px;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: var(--text-secondary);
  font-size: 12px;
  cursor: pointer;
  transition: color 0.22s ease;
  user-select: none;
}
.mode-btn:hover { color: var(--text-primary); }
.mode-btn.active {
  color: var(--text-primary);
  /* 文字在液态层之上，无额外背景，靠指示器提供液态效果 */
}
</style>
