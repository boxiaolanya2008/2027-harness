<script setup lang="ts">
import { computed, ref } from 'vue'

interface DiffRow {
  kind: 'context' | 'addition' | 'deletion'
  text: string
  beforeLine?: number
  afterLine?: number
}

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

function lines(value: string | null | undefined): string[] {
  if (value == null || value === '') return []
  return value.replace(/\r\n?/g, '\n').split('\n')
}

function makeRows(before: string[], after: string[]): DiffRow[] {
  // LCS gives a compact, readable unified diff while keeping the renderer dependency-free.
  const maxCells = 1_200_000
  if (before.length * after.length > maxCells) {
    const rows: DiffRow[] = []
    const length = Math.max(before.length, after.length)
    for (let i = 0; i < length; i += 1) {
      if (i < before.length && i < after.length && before[i] === after[i]) {
        rows.push({ kind: 'context', text: before[i], beforeLine: i + 1, afterLine: i + 1 })
      } else {
        if (i < before.length) rows.push({ kind: 'deletion', text: before[i], beforeLine: i + 1 })
        if (i < after.length) rows.push({ kind: 'addition', text: after[i], afterLine: i + 1 })
      }
    }
    return rows
  }

  const width = after.length + 1
  const table = Array.from({ length: before.length + 1 }, () => new Uint32Array(width))
  for (let beforeIndex = before.length - 1; beforeIndex >= 0; beforeIndex -= 1) {
    for (let afterIndex = after.length - 1; afterIndex >= 0; afterIndex -= 1) {
      table[beforeIndex][afterIndex] = before[beforeIndex] === after[afterIndex]
        ? table[beforeIndex + 1][afterIndex + 1] + 1
        : Math.max(table[beforeIndex + 1][afterIndex], table[beforeIndex][afterIndex + 1])
    }
  }

  const rows: DiffRow[] = []
  let beforeIndex = 0
  let afterIndex = 0
  let beforeLine = 1
  let afterLine = 1
  while (beforeIndex < before.length || afterIndex < after.length) {
    if (beforeIndex < before.length && afterIndex < after.length && before[beforeIndex] === after[afterIndex]) {
      rows.push({ kind: 'context', text: before[beforeIndex], beforeLine, afterLine })
      beforeIndex += 1
      afterIndex += 1
      beforeLine += 1
      afterLine += 1
    } else if (afterIndex < after.length && (beforeIndex >= before.length || table[beforeIndex][afterIndex + 1] >= table[beforeIndex + 1][afterIndex])) {
      rows.push({ kind: 'addition', text: after[afterIndex], afterLine })
      afterIndex += 1
      afterLine += 1
    } else if (beforeIndex < before.length) {
      rows.push({ kind: 'deletion', text: before[beforeIndex], beforeLine })
      beforeIndex += 1
      beforeLine += 1
    }
  }
  return rows
}

const diffRows = computed(() => makeRows(lines(props.before), lines(props.after)))
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
        <span class="diff-add-count">+{{ diffRows.filter((row) => row.kind === 'addition').length }}</span>
        <span class="diff-delete-count">-{{ diffRows.filter((row) => row.kind === 'deletion').length }}</span>
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
  background: rgba(0, 0, 0, 0.14);
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
.diff-head:hover { background: rgba(255, 255, 255, 0.04); }
.diff-title, .diff-summary { display: flex; align-items: center; gap: 8px; min-width: 0; }
.diff-operation { color: var(--text-primary); font-weight: 600; white-space: nowrap; }
.diff-path { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--text-secondary); }
.diff-add-count { color: #49b675; }
.diff-delete-count { color: #e86d75; }
.diff-chevron { font-size: 18px; line-height: 12px; transition: transform 120ms ease; }
.diff-chevron--open { transform: rotate(90deg); }
.diff-body { border-top: 1px solid var(--glass-border); overflow: auto; max-height: 360px; }
.diff-row { display: grid; grid-template-columns: 42px 42px 18px minmax(max-content, 1fr); min-width: max-content; line-height: 1.55; font-size: 12px; }
.diff-line-number { padding: 1px 7px; color: var(--text-faint); text-align: right; user-select: none; }
.diff-marker { padding: 1px 0; text-align: center; color: var(--text-faint); user-select: none; }
.diff-text { padding: 1px 10px 1px 4px; color: var(--text-secondary); white-space: pre; font-family: 'Cascadia Code', Consolas, monospace; }
.diff-row--addition { background: rgba(48, 170, 97, 0.15); }
.diff-row--addition .diff-marker, .diff-row--addition .diff-text { color: #65ce8b; }
.diff-row--deletion { background: rgba(220, 74, 82, 0.15); }
.diff-row--deletion .diff-marker, .diff-row--deletion .diff-text { color: #f18b91; }
.diff-empty { padding: 12px; color: var(--text-faint); font-size: 12px; }
</style>
