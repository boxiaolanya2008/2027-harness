<script setup lang="ts">
import { computed, ref } from 'vue'
import { Icon } from '@iconify/vue'
import { getDiffStats, makeDiffRows } from '@/utils/fileDiff'
import { fileIcon } from '@/utils/fileIcon'

const props = withDefaults(defineProps<{
  before?: string | null
  after?: string | null
  path?: string
  operation?: string
  hideHeader?: boolean
  foldUnchanged?: boolean
  contextLines?: number
}>(), {
  before: '',
  after: '',
  path: '',
  operation: 'update',
  hideHeader: false,
  foldUnchanged: true,
  contextLines: 3
})

const expanded = ref(true)
const expandedFolds = ref<Set<number>>(new Set())
const diffRows = computed(() => makeDiffRows(props.before, props.after))
const diffStats = computed(() => getDiffStats(props.before, props.after))
type DisplayRow =
  | { type: 'row'; row: ReturnType<typeof makeDiffRows>[number] }
  | { type: 'fold'; id: number; rows: ReturnType<typeof makeDiffRows>; count: number }

const displayRows = computed<DisplayRow[]>(() => {
  if (!props.foldUnchanged) return diffRows.value.map((row) => ({ type: 'row', row }))
  const result: DisplayRow[] = []
  const context = Math.max(0, props.contextLines)
  let index = 0
  let foldId = 0
  while (index < diffRows.value.length) {
    const row = diffRows.value[index]
    if (row.kind !== 'context') {
      result.push({ type: 'row', row })
      index += 1
      continue
    }
    let end = index
    while (end < diffRows.value.length && diffRows.value[end].kind === 'context') end += 1
    const run = diffRows.value.slice(index, end)
    const retained = context * 2
    if (run.length > retained + 2) {
      const id = foldId++
      result.push(...run.slice(0, context).map((item) => ({ type: 'row' as const, row: item })))
      const hidden = run.slice(context, run.length - context)
      if (expandedFolds.value.has(id)) {
        result.push(...hidden.map((item) => ({ type: 'row' as const, row: item })))
      } else {
        result.push({ type: 'fold', id, rows: hidden, count: hidden.length })
      }
      result.push(...run.slice(run.length - context).map((item) => ({ type: 'row' as const, row: item })))
    } else {
      result.push(...run.map((item) => ({ type: 'row' as const, row: item })))
    }
    index = end
  }
  return result
})
const operationLabel = computed(() => {
  const operation = props.operation.toLowerCase()
  if (['create', 'created', 'new', 'new_file', 'add'].includes(operation)) return '新增'
  if (['delete', 'deleted', 'remove', 'removed'].includes(operation)) return '删除'
  return '已编辑'
})
const hasChanges = computed(() => diffRows.value.some((row) => row.kind !== 'context'))
</script>

<template>
  <section class="diff-view" :class="{ 'diff-view--empty': !hasChanges, 'diff-view--no-header': hideHeader }">
    <button v-if="!hideHeader" class="diff-head" type="button" :aria-expanded="expanded" @click="expanded = !expanded">
      <span class="diff-file">
        <Icon :icon="fileIcon(path)" width="17" />
        <span class="diff-operation">{{ operationLabel }}</span>
        <code v-if="path" class="diff-path">{{ path }}</code>
      </span>
      <span class="diff-summary">
        <span class="diff-add-count">+{{ diffStats.additions }}</span>
        <span class="diff-delete-count">-{{ diffStats.deletions }}</span>
        <Icon class="diff-chevron" :class="{ 'diff-chevron--open': expanded }" icon="mdi:chevron-right" width="17" />
      </span>
    </button>
    <div v-if="hideHeader || expanded" class="diff-body">
      <div v-if="!diffRows.length" class="diff-empty">空文件</div>
      <div v-else-if="!hasChanges" class="diff-empty">没有内容变化</div>
      <div v-else class="diff-code">
        <template v-for="(item, index) in displayRows" :key="`${index}-${item.type}`">
          <button v-if="item.type === 'fold'" class="diff-fold" type="button" @click="expandedFolds = new Set([...expandedFolds, item.id])">
            <span class="diff-fold-gutter">⋯</span>
            <span class="diff-fold-marker" />
            <span>{{ item.count }} 行未修改内容</span>
            <span>展开</span>
          </button>
          <div v-else class="diff-row" :class="`diff-row--${item.row.kind}`">
            <span class="diff-line-number">{{ item.row.afterLine ?? item.row.beforeLine ?? '' }}</span>
            <span class="diff-marker">{{ item.row.kind === 'addition' ? '+' : item.row.kind === 'deletion' ? '-' : ' ' }}</span>
            <code class="diff-text">{{ item.row.text || ' ' }}</code>
          </div>
        </template>
      </div>
    </div>
  </section>
</template>

<style scoped>
.diff-view {
  min-width: 0;
  overflow: hidden;
  border-top: 1px solid var(--glass-border);
  border-bottom: 1px solid var(--glass-border);
  background: var(--diff-surface);
}
.diff-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  min-height: 36px;
  padding: 0 var(--space-3);
  border: 0;
  background: var(--surface-bg);
  color: var(--text-secondary);
  cursor: pointer;
  font: inherit;
  text-align: left;
}
.diff-head:hover { background: var(--hover-bg); }
.diff-file, .diff-summary { display: flex; align-items: center; gap: var(--space-2); min-width: 0; }
.diff-file :deep(svg) { flex: 0 0 auto; color: var(--text-faint); }
.diff-operation { flex: 0 0 auto; color: var(--text-primary); font-weight: 600; }
.diff-path { min-width: 0; overflow: hidden; color: var(--text-secondary); text-overflow: ellipsis; white-space: nowrap; font-family: 'Cascadia Code', Consolas, monospace; }
.diff-summary { flex: 0 0 auto; font-size: 12px; }
.diff-add-count { color: var(--diff-add); }
.diff-delete-count { color: var(--diff-remove); }
.diff-chevron { flex: 0 0 auto; color: var(--text-faint); transition: transform 150ms ease; }
.diff-chevron--open { transform: rotate(90deg); }
.diff-body { border-top: 1px solid var(--glass-border); overflow: auto; max-height: 420px; background: var(--code-surface); }
.diff-view--no-header .diff-body { border-top: 0; }
.diff-code { min-width: max-content; }
.diff-row {
  --line-number-width: 36px;
  display: grid;
  grid-template-columns: var(--line-number-width) 14px minmax(max-content, 1fr);
  min-width: max-content;
  line-height: 1.62;
  font-size: 12px;
}
.diff-line-number {
  min-width: 0;
  padding: 1px 5px;
  border-right: 1px solid color-mix(in srgb, var(--glass-border) 75%, transparent);
  color: var(--text-faint);
  background: color-mix(in srgb, var(--panel-bg) 70%, var(--code-surface));
  text-align: right;
  user-select: none;
}
.diff-marker { padding: 1px 0; color: var(--text-faint); text-align: center; user-select: none; }
.diff-text { padding: 1px 14px 1px 4px; color: var(--code-text); white-space: pre; font-family: 'Cascadia Code', Consolas, monospace; }
.diff-row--addition { background: var(--diff-add-bg); }
.diff-row--addition .diff-marker, .diff-row--addition .diff-text { color: var(--diff-add); }
.diff-row--deletion { background: var(--diff-remove-bg); }
.diff-row--deletion .diff-marker, .diff-row--deletion .diff-text { color: var(--diff-remove); }
.diff-fold {
  --line-number-width: 36px;
  display: grid;
  grid-template-columns: var(--line-number-width) 14px minmax(max-content, 1fr) auto;
  align-items: center;
  width: 100%;
  min-width: max-content;
  padding: 3px 12px;
  border: 0;
  border-top: 1px solid var(--glass-border);
  border-bottom: 1px solid var(--glass-border);
  color: var(--text-secondary);
  background: var(--panel-bg);
  cursor: pointer;
  font: 12px 'Cascadia Code', Consolas, monospace;
  text-align: left;
}
.diff-fold-gutter { color: var(--text-faint); text-align: center; }
.diff-fold-marker { height: 100%; border-left: 1px solid color-mix(in srgb, var(--glass-border) 75%, transparent); }
.diff-fold:hover { color: var(--accent); background: var(--hover-bg); }
.diff-fold span:last-child { color: var(--accent); }
</style>
