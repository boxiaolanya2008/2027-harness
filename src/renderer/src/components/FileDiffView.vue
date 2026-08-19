<script setup lang="ts">
import { computed, ref } from 'vue'
import { getDiffStats, makeDiffRows } from '@/utils/fileDiff'

const props = withDefaults(defineProps<{
  before?: string | null
  after?: string | null
  path?: string
  operation?: string
}>(), {
  before: '',
  after: '',
  path: '',
  operation: 'update'
})

const expanded = ref(true)

const diffRows = computed(() => makeDiffRows(props.before, props.after))
const diffStats = computed(() => getDiffStats(props.before, props.after))
const operationLabel = computed(() => {
  const operation = props.operation.toLowerCase()
  if (['create', 'created', 'new', 'new_file', 'add'].includes(operation)) return '新增文件'
  if (['delete', 'deleted', 'remove', 'removed'].includes(operation)) return '删除文件'
  return '修改文件'
})
const hasChanges = computed(() => diffRows.value.some((row) => row.kind !== 'context'))
</script>

<template>
  <section class="diff-view" :class="{ 'diff-view--empty': !hasChanges }">
    <button class="diff-head" type="button" :aria-expanded="expanded" @click="expanded = !expanded">
      <span class="diff-title">
        <span class="diff-operation">{{ operationLabel }}</span>
        <code v-if="path" class="diff-path">{{ path }}</code>
      </span>
      <span class="diff-summary">
        <span class="diff-add-count">+{{ diffStats.additions }}</span>
        <span class="diff-delete-count">-{{ diffStats.deletions }}</span>
        <span class="diff-chevron" :class="{ 'diff-chevron--open': expanded }">›</span>
      </span>
    </button>
    <div v-if="expanded" class="diff-body">
      <div v-if="!diffRows.length" class="diff-empty">空文件</div>
      <div v-else-if="!hasChanges" class="diff-empty">没有内容变化</div>
      <div v-for="(row, index) in diffRows" :key="`${index}-${row.kind}`" class="diff-row" :class="`diff-row--${row.kind}`">
        <span class="diff-line-number">{{ row.beforeLine ?? '' }}</span>
        <span class="diff-line-number">{{ row.afterLine ?? '' }}</span>
        <span class="diff-marker">{{ row.kind === 'addition' ? '+' : row.kind === 'deletion' ? '-' : ' ' }}</span>
        <code class="diff-text">{{ row.text || ' ' }}</code>
      </div>
    </div>
  </section>
</template>

<style scoped>
.diff-view {
  margin: 0 var(--space-3) var(--space-3);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-sm);
  overflow: hidden;
  background: var(--diff-surface);
}
.diff-head {
  width: 100%;
  border: 0;
  background: transparent;
  color: var(--text-secondary);
  padding: 7px 10px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  cursor: pointer;
  text-align: left;
  font: inherit;
}
.diff-head:hover { background: var(--hover-bg); }
.diff-title, .diff-summary { display: flex; align-items: center; gap: 8px; min-width: 0; }
.diff-operation { color: var(--text-primary); font-weight: 600; white-space: nowrap; }
.diff-path { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--text-secondary); }
.diff-add-count { color: var(--diff-add); }
.diff-delete-count { color: var(--diff-remove); }
.diff-chevron { font-size: 18px; line-height: 12px; transition: transform 120ms ease; }
.diff-chevron--open { transform: rotate(90deg); }
.diff-body { border-top: 1px solid var(--glass-border); overflow: auto; max-height: 360px; }
.diff-row { display: grid; grid-template-columns: 42px 42px 18px minmax(max-content, 1fr); min-width: max-content; line-height: 1.55; font-size: 12px; }
.diff-line-number { padding: 1px 7px; color: var(--text-faint); text-align: right; user-select: none; }
.diff-marker { padding: 1px 0; text-align: center; color: var(--text-faint); user-select: none; }
.diff-text { padding: 1px 10px 1px 4px; color: var(--text-secondary); white-space: pre; font-family: 'Cascadia Code', Consolas, monospace; }
.diff-row--addition { background: var(--diff-add-bg); }
.diff-row--addition .diff-marker, .diff-row--addition .diff-text { color: var(--diff-add); }
.diff-row--deletion { background: var(--diff-remove-bg); }
.diff-row--deletion .diff-marker, .diff-row--deletion .diff-text { color: var(--diff-remove); }
.diff-empty { padding: 12px; color: var(--text-faint); font-size: 12px; }
</style>
