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
      <button type="button" class="model-row" :class="{ active: activeSub === 'model' }" @click="toggleModel">
        <span class="row-label">模型</span>
        <span class="row-value" :title="model">{{ model }}</span>
        <Icon icon="mdi:chevron-right" width="16" class="row-arrow" />
      </button>
      <button type="button" class="model-row" :class="{ active: activeSub === 'reasoning' }" @click="toggleReasoning">
        <span class="row-label">推理强度</span>
        <span class="row-value row-value--center" :title="reasoningLabel(reasoning)">{{ reasoningLabel(reasoning) }}</span>
        <Icon icon="mdi:chevron-right" width="16" class="row-arrow" />
      </button>
    </div>

    <!-- 模型二级面板（点击触发，显示在左侧固定位置） -->
    <div v-if="activeSub === 'model'" class="submenu submenu--model">
      <div v-if="!modelOptions.length" class="submenu-empty">暂无模型</div>
      <button
        v-for="m in modelOptions"
        :key="m"
        type="button"
        class="submenu-row"
        :class="{ active: m === model }"
        @click="selectModel(m)"
      >
        <span class="submenu-text" :title="m">{{ m }}</span>
        <Icon v-if="m === model" icon="mdi:check" width="16" class="submenu-check" />
      </button>
    </div>

    <!-- 推理强度二级面板（点击触发，显示在左侧固定位置） -->
    <div v-if="activeSub === 'reasoning'" class="submenu submenu--reasoning">
      <button
        v-for="opt in reasoningOptions"
        :key="opt.value"
        type="button"
        class="submenu-row"
        :class="{ active: opt.value === reasoning }"
        @click="selectReasoning(opt.value)"
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
}
.model-popover {
  width: 230px;
  padding: 4px;
  border: 1px solid var(--glass-border);
  border-radius: 10px;
  background: var(--surface-bg);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.14), 0 2px 6px rgba(0, 0, 0, 0.06);
  display: flex;
  flex-direction: column;
  gap: 1px;
  position: relative;
}
.model-row {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 7px 8px;
  border: 0;
  border-radius: 7px;
  background: transparent;
  text-align: left;
  cursor: pointer;
}
.model-row:hover,
.model-row.active {
  background: var(--hover-bg);
}
.row-label {
  flex: 0 0 56px;
  font-size: 12px;
  color: var(--text-primary);
  font-weight: 500;
}
.row-value {
  flex: 1;
  min-width: 0;
  font-size: 12px;
  color: var(--text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-align: right;
}
.row-value--center { text-align: center; color: var(--text-faint); }
.row-arrow {
  flex: 0 0 auto;
  color: var(--text-faint);
}

.submenu {
  position: absolute;
  right: calc(100% + 6px);
  left: auto;
  width: 118px;
  padding: 4px;
  border: 1px solid var(--glass-border);
  border-radius: 10px;
  background: var(--surface-bg);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.14), 0 2px 6px rgba(0, 0, 0, 0.06);
  display: flex;
  flex-direction: column;
  gap: 1px;
}
.submenu--model { top: 0; }
.submenu--reasoning { top: 32px; }
.submenu-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  width: 100%;
  padding: 6px 8px;
  border: 0;
  border-radius: 7px;
  background: transparent;
  text-align: left;
  cursor: pointer;
  font-size: 12px;
  color: var(--text-primary);
}
.submenu-row:hover { background: var(--hover-bg); }
.submenu-row.active { background: var(--selected-bg); }
.submenu-text {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.submenu-check { flex: 0 0 auto; color: var(--accent); }
.submenu-empty {
  padding: 8px;
  text-align: center;
  color: var(--text-faint);
  font-size: 11px;
}
</style>
