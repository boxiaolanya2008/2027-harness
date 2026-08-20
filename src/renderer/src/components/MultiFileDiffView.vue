<script setup lang="ts">
import { ref } from 'vue'
import { Icon } from '@iconify/vue'
import type { DiffFileBrief } from '@/types'
import { getDiffStats, makeDiffRows } from '@/utils/fileDiff'

const props = withDefaults(defineProps<{
  files?: DiffFileBrief[]
  contextLines?: number
}>(), {
  files: () => [],
  contextLines: 3
})

const expandedFolds = ref<Map<string, Set<number>>>(new Map())

function isFoldExpanded(filePath: string, foldId: number) {
  return expandedFolds.value.get(filePath)?.has(foldId) ?? false
}
function expandFold(filePath: string, foldId: number) {
  const next = new Map(expandedFolds.value)
  const set = new Set(next.get(filePath) ?? [])
  set.add(foldId)
  next.set(filePath, set)
  expandedFolds.value = next
}

function fileStats(f: DiffFileBrief) {
  // Prefer real diff calculation when before/after are provided (fixes +0 -0 bug)
  if (f.before !== undefined || f.after !== undefined) {
    return getDiffStats(f.before ?? '', f.after ?? '')
  }
  if (f.lines?.length) {
    let a = 0, d = 0
    for (const l of f.lines) {
      if (l.type === 'add') a++
      else if (l.type === 'del') d++
    }
    return { additions: a, deletions: d }
  }
  return { additions: f.additions ?? 0, deletions: f.deletions ?? 0 }
}

function fileRows(f: DiffFileBrief) {
  if (f.before !== undefined || f.after !== undefined) {
    return makeDiffRows(f.before ?? '', f.after ?? '')
  }
  if (f.lines?.length) {
    return f.lines.map(l => ({
      kind: l.type === 'add' ? 'addition' : l.type === 'del' ? 'deletion' : 'context',
      text: l.text,
      beforeLine: l.type !== 'add' ? l.num : undefined,
      afterLine: l.type !== 'del' ? l.num : undefined
    } as ReturnType<typeof makeDiffRows>[number]))
  }
  if (f.content) {
    return makeDiffRows('', f.content)
  }
  return [] as ReturnType<typeof makeDiffRows>
}

type DisplayItem =
  | { type: 'row'; row: ReturnType<typeof makeDiffRows>[number] }
  | { type: 'fold'; id: number; count: number }

function displayRowsFor(f: DiffFileBrief): DisplayItem[] {
  const rows = fileRows(f)
  const ctx = Math.max(0, props.contextLines)
  const result: DisplayItem[] = []
  let idx = 0
  let foldId = 0
  while (idx < rows.length) {
    if (rows[idx].kind !== 'context') {
      result.push({ type: 'row', row: rows[idx] })
      idx += 1
      continue
    }
    let end = idx
    while (end < rows.length && rows[end].kind === 'context') end += 1
    const run = rows.slice(idx, end)
    const retained = ctx * 2
    if (run.length > retained + 2) {
      const id = foldId++
      result.push(...run.slice(0, ctx).map(r => ({ type: 'row' as const, row: r })))
      if (isFoldExpanded(f.path, id)) {
        result.push(...run.slice(ctx, run.length - ctx).map(r => ({ type: 'row' as const, row: r })))
      } else {
        result.push({ type: 'fold', id, count: run.length - ctx * 2 })
      }
      result.push(...run.slice(run.length - ctx).map(r => ({ type: 'row' as const, row: r })))
    } else {
      result.push(...run.map(r => ({ type: 'row' as const, row: r })))
    }
    idx = end
  }
  return result
}
</script>

<template>
  <div class="diff-stack">
    <section v-for="file in files" :key="file.path" class="diff-file">
      <header class="diff-file-header">
        <span class="file-icon">
          <Icon icon="mdi:file-outline" width="15" />
        </span>
        <code class="file-path" :title="file.path">{{ file.path }}</code>
        <span class="file-stats">
          <span class="stat-add">+{{ fileStats(file).additions }}</span>
          <span class="stat-del">-{{ fileStats(file).deletions }}</span>
        </span>
      </header>

      <div class="diff-body">
        <template v-if="displayRowsFor(file).length">
          <template v-for="(item, idx) in displayRowsFor(file)" :key="idx">
            <button
              v-if="item.type === 'fold'"
              class="diff-fold"
              type="button"
              @click="expandFold(file.path, item.id)"
            >
              <span class="diff-fold-gutter">⋯</span>
              <span class="diff-fold-marker" />
              <span>{{ item.count }} 行未修改内容</span>
              <span>展开</span>
            </button>
            <div
              v-else
              class="diff-row"
              :class="{
                'diff-row--add': item.row.kind === 'addition',
                'diff-row--del': item.row.kind === 'deletion',
                'diff-row--ctx': item.row.kind === 'context'
              }"
            >
              <span class="diff-gutter">{{ item.row.afterLine ?? item.row.beforeLine ?? '' }}</span>
              <span class="diff-marker">{{ item.row.kind === 'addition' ? '+' : item.row.kind === 'deletion' ? '-' : ' ' }}</span>
              <code class="diff-text">{{ item.row.text || ' ' }}</code>
            </div>
          </template>
        </template>
        <div v-else class="diff-empty">空文件</div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.diff-stack {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
}

.diff-file {
  border: 1px solid var(--glass-border);
  border-radius: 6px;
  overflow: hidden;
  background: var(--surface-bg);
}

.diff-file-header {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 34px;
  padding: 0 10px;
  background: var(--panel-bg);
  border-bottom: 1px solid var(--glass-border);
  font-size: 12px;
}

.file-icon {
  display: grid;
  place-items: center;
  width: 20px;
  height: 20px;
  border-radius: 4px;
  background: #d97706;
  color: white;
  font-size: 10px;
  flex: 0 0 auto;
}

.file-path {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--text-primary);
  font-family: 'Cascadia Code', Consolas, monospace;
  font-size: 12px;
}

.file-stats {
  display: inline-flex;
  gap: 6px;
  flex: 0 0 auto;
  font-family: 'Cascadia Code', Consolas, monospace;
  font-size: 12px;
}

.stat-add { color: #1a7f37; }
.stat-del { color: #cf222e; }

.diff-body {
  max-height: 320px;
  overflow: auto;
  background: var(--code-surface);
  font-size: 12px;
  line-height: 1.6;
}

.diff-body::-webkit-scrollbar { width: 8px; height: 8px; }
.diff-body::-webkit-scrollbar-thumb {
  background: color-mix(in srgb, var(--text-faint) 28%, transparent);
  border-radius: 4px;
}
.diff-body::-webkit-scrollbar-track { background: transparent; }

.diff-row {
  display: grid;
  grid-template-columns: 44px 16px minmax(0, 1fr);
  min-width: max-content;
}

.diff-gutter {
  padding: 0 8px 0 6px;
  border-right: 1px solid color-mix(in srgb, var(--glass-border) 70%, transparent);
  color: var(--text-faint);
  background: color-mix(in srgb, var(--panel-bg) 65%, var(--code-surface));
  text-align: right;
  user-select: none;
  font-family: 'Cascadia Code', Consolas, monospace;
}

.diff-marker {
  text-align: center;
  color: var(--text-faint);
  user-select: none;
}

.diff-text {
  padding: 0 12px;
  white-space: pre;
  color: var(--code-text);
  font-family: 'Cascadia Code', Consolas, monospace;
}

.diff-row--add { background: var(--diff-add-bg); }
.diff-row--add .diff-marker,
.diff-row--add .diff-text { color: var(--diff-add); }
.diff-row--del { background: var(--diff-remove-bg); }
.diff-row--del .diff-marker,
.diff-row--del .diff-text { color: var(--diff-remove); }
.diff-row--ctx .diff-text { color: var(--code-text); }

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

.diff-empty {
  padding: 16px 12px;
  color: var(--text-secondary);
  text-align: center;
}
</style>
