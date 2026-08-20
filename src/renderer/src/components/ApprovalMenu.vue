<script setup lang="ts">
import { Icon } from '@iconify/vue'
import type { ApprovalMode } from '@/types'

defineProps<{
  modelValue: ApprovalMode
}>()
const emit = defineEmits<{
  (e: 'update:modelValue', v: ApprovalMode): void
}>()

const options: Array<{
  value: ApprovalMode
  icon: string
  title: string
  desc: string
  danger?: boolean
}> = [
  {
    value: 'request',
    icon: 'mdi:hand-back-right-outline',
    title: '请求批准',
    desc: '编辑外部文件和使用互联网时始终询问'
  },
  {
    value: 'help',
    icon: 'mdi:shield-check-outline',
    title: '帮我批准',
    desc: '仅对检测到的风险操作请求批准'
  },
  {
    value: 'full',
    icon: 'mdi:alert-circle-outline',
    title: '完全访问权限',
    desc: '可不受限制地访问互联网和你电脑上的任何文件',
    danger: true
  }
]
</script>

<template>
  <div class="approval-menu">
    <button
      v-for="opt in options"
      :key="opt.value"
      type="button"
      class="approval-row"
      :class="{ active: modelValue === opt.value, danger: opt.danger }"
      @mousedown.prevent="emit('update:modelValue', opt.value)"
    >
      <span class="row-icon" :class="{ 'row-icon--danger': opt.danger }">
        <Icon :icon="opt.icon" width="18" />
      </span>
      <span class="row-text">
        <strong :class="{ 'text-danger': opt.danger }">{{ opt.title }}</strong>
        <span :class="{ 'desc-danger': opt.danger }">{{ opt.desc }}</span>
      </span>
      <span v-if="modelValue === opt.value" class="row-check">
        <Icon icon="mdi:check" width="18" />
      </span>
    </button>
  </div>
</template>

<style scoped>
.approval-menu {
  position: absolute;
  left: 0;
  bottom: calc(100% + 8px);
  z-index: 20;
  width: 360px;
  padding: 8px;
  border: 1px solid color-mix(in srgb, var(--glass-border) 70%, transparent);
  border-radius: 12px;
  background: color-mix(in srgb, var(--surface-bg) 92%, transparent);
  backdrop-filter: blur(14px) saturate(1.5);
  -webkit-backdrop-filter: blur(14px) saturate(1.5);
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.18), 0 2px 8px rgba(0, 0, 0, 0.08);
}

.approval-row {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 10px 10px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  text-align: left;
  cursor: pointer;
}

.approval-row:hover {
  background: color-mix(in srgb, var(--hover-bg) 80%, transparent);
}
.approval-row.active {
  background: color-mix(in srgb, var(--hover-bg) 90%, transparent);
}
.approval-row + .approval-row {
  position: relative;
  margin-top: 2px;
}
.approval-row + .approval-row::before {
  content: '';
  position: absolute;
  top: -2px;
  left: 10px;
  right: 10px;
  height: 1px;
  background: color-mix(in srgb, var(--glass-border) 65%, transparent);
  pointer-events: none;
}
.approval-row.danger {
  position: relative;
  overflow: hidden;
}
.approval-row.danger.active {
  background: linear-gradient(135deg, color-mix(in srgb, rgba(255,243,224,0.96) 85%, transparent), color-mix(in srgb, rgba(255,183,77,0.22) 70%, transparent));
  backdrop-filter: blur(14px) saturate(1.6);
  -webkit-backdrop-filter: blur(14px) saturate(1.6);
  border: 1px solid color-mix(in srgb, rgba(230,81,0,0.22) 55%, transparent);
  box-shadow: 0 4px 16px rgba(230,81,0,0.14), inset 0 1px 1px rgba(255,255,255,0.75), inset 0 -1px 1px rgba(230,81,0,0.06);
}
.approval-row.danger.active::before {
  content: '';
  position: absolute;
  inset: -30% -50%;
  background: linear-gradient(120deg, transparent 32%, rgba(255,255,255,0.55) 48%, transparent 64%);
  transform: translateX(-100%) skewX(-14deg);
  animation: liquid-shine 3s ease-in-out infinite;
  pointer-events: none;
}
@keyframes liquid-shine {
  0% { transform: translateX(-100%) skewX(-14deg); }
  45% { transform: translateX(-100%) skewX(-14deg); }
  72% { transform: translateX(100%) skewX(-14deg); }
  100% { transform: translateX(100%) skewX(-14deg); }
}

.row-icon {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  flex: 0 0 auto;
  border-radius: 50%;
  background: var(--panel-bg);
  border: 1px solid var(--glass-border);
  color: var(--text-secondary);
}
.row-icon--danger {
  color: #e65100;
  border-color: rgba(230, 81, 0, 0.25);
  background: rgba(230, 81, 0, 0.08);
}

.row-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
  min-width: 0;
}
.row-text strong {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
}
.row-text span {
  font-size: 12px;
  color: var(--text-secondary);
  line-height: 1.3;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.text-danger { color: #e65100 !important; }
.desc-danger { color: #e65100 !important; opacity: 0.9; }

.row-check {
  flex: 0 0 auto;
  color: var(--text-primary);
  display: grid;
  place-items: center;
}
</style>
