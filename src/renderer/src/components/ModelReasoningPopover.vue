<script setup lang="ts">
import { ref } from 'vue'
import { Icon } from '@iconify/vue'
import type { ReasoningEffort } from '@/types'

const props = withDefaults(defineProps<{
  model: string
  reasoning: ReasoningEffort
  modelOptions?: string[]
}>(), {
  modelOptions: () => []
})

const emit = defineEmits<{
  (e: 'update:model', v: string): void
  (e: 'update:reasoning', v: ReasoningEffort): void
  (e: 'close'): void
}>()

const activeSub = ref<'model' | 'reasoning' | null>(null)

function toggleModel() {
  activeSub.value = activeSub.value === 'model' ? null : 'model'
}
function toggleReasoning() {
  activeSub.value = activeSub.value === 'reasoning' ? null : 'reasoning'
}

const reasoningOptions: Array<{ value: ReasoningEffort; label: string }> = [
  { value: 'low', label: '轻度' },
  { value: 'medium', label: '中' },
  { value: 'high', label: '高' },
  { value: 'xhigh', label: '极高' }
]

function selectModel(m: string) {
  emit('update:model', m)
  activeSub.value = null
}
function selectReasoning(v: ReasoningEffort) {
  emit('update:reasoning', v)
  activeSub.value = null
}

function reasoningLabel(v: ReasoningEffort) {
  const found = reasoningOptions.find(o => o.value === v)
  return found?.label || '中'
}
</script>

<template>
  <div class="popover-root">
    <div class="model-popover">
      <button type="button" class="model-row" :class="{ active: activeSub === 'model' }" @mousedown.prevent="toggleModel">
        <span class="row-label">模型</span>
        <span class="row-value" :title="model">{{ model }}</span>
        <Icon icon="mdi:chevron-right" width="18" class="row-arrow" />
      </button>
      <button type="button" class="model-row" :class="{ active: activeSub === 'reasoning' }" @mousedown.prevent="toggleReasoning">
        <span class="row-label">推理强度</span>
        <span class="row-value row-value--center" :title="reasoningLabel(reasoning)">{{ reasoningLabel(reasoning) }}</span>
        <Icon icon="mdi:chevron-right" width="18" class="row-arrow" />
      </button>
    </div>

    <!-- 模型二级面板 -->
    <div v-if="activeSub === 'model'" class="submenu submenu--model">
      <div v-if="!modelOptions.length" class="submenu-empty">暂无模型</div>
      <button
        v-for="m in modelOptions"
        :key="m"
        type="button"
        class="submenu-row"
        :class="{ active: m === model }"
        @mousedown.prevent="selectModel(m)"
      >
        <span class="submenu-text" :title="m">{{ m }}</span>
        <Icon v-if="m === model" icon="mdi:check" width="16" class="submenu-check" />
      </button>
    </div>

    <!-- 推理强度二级面板（复刻图二：轻度/中/高/极高） -->
    <div v-if="activeSub === 'reasoning'" class="submenu submenu--reasoning">
      <button
        v-for="opt in reasoningOptions"
        :key="opt.value"
        type="button"
        class="submenu-row"
        :class="{ active: opt.value === reasoning }"
        @mousedown.prevent="selectReasoning(opt.value)"
      >
        <span class="submenu-text">{{ opt.label }}</span>
        <Icon v-if="opt.value === reasoning" icon="mdi:check" width="16" class="submenu-check" />
      </button>
    </div>
  </div>
</template>

<style scoped>
.popover-root {
  position: absolute;
  right: 0;
  bottom: calc(100% + 8px);
  z-index: 18;
  display: flex;
  gap: 8px;
  align-items: flex-start;
}
.model-popover {
  width: 280px;
  padding: 6px;
  border: 1px solid var(--glass-border);
  border-radius: 12px;
  background: var(--surface-bg);
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.18), 0 2px 8px rgba(0, 0, 0, 0.08);
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.model-row {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 10px 10px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  text-align: left;
  cursor: pointer;
}
.model-row:hover,
.model-row.active {
  background: var(--hover-bg);
}
.row-label {
  flex: 0 0 64px;
  font-size: 13px;
  color: var(--text-primary);
  font-weight: 500;
}
.row-value {
  flex: 1;
  min-width: 0;
  font-size: 13px;
  color: var(--text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-align: right;
}
.row-value--center { text-align: center; }
.row-arrow {
  flex: 0 0 auto;
  color: var(--text-faint);
}

.submenu {
  width: 160px;
  padding: 6px;
  border: 1px solid var(--glass-border);
  border-radius: 12px;
  background: var(--surface-bg);
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.18), 0 2px 8px rgba(0, 0, 0, 0.08);
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.submenu-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  width: 100%;
  padding: 8px 10px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  text-align: left;
  cursor: pointer;
  font-size: 13px;
  color: var(--text-primary);
}
.submenu-row:hover { background: var(--hover-bg); }
.submenu-row.active { background: var(--hover-bg); }
.submenu-text {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.submenu-check { flex: 0 0 auto; color: var(--text-primary); }
.submenu-empty {
  padding: 10px;
  text-align: center;
  color: var(--text-faint);
  font-size: 12px;
}
</style>
