<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Icon } from '@iconify/vue'
import FileDiffView from './FileDiffView.vue'
import { useChatStore } from '@/stores/chat'
import { getDiffStats } from '@/utils/fileDiff'
import { fileIcon } from '@/utils/fileIcon'

type FileState = { exists: boolean; content: string | null; sha256: string | null; size: number }
type Change = {
  path: string
  operation: string
  before: FileState
  after: FileState
  latestChangeId: string
  changeCount: number
  latestTimestamp: number
}

const chat = useChatStore()
const changes = ref<Change[]>([])
const loading = ref(false)
const forceNext = ref(false)
const expandedPath = ref<string | null>(null)

function fileName(path: string) {
  return path.split(/[\\/]/).filter(Boolean).pop() || path
}

function parentPath(path: string) {
  const parts = path.split(/[\\/]/).filter(Boolean)
  return parts.length > 1 ? parts.slice(0, -1).join('/') : ''
}

const fileTargetLabel = computed(() => {
  try { return localStorage.getItem('codex_file_target') || '系统默认' } catch { return '系统默认' }
})
const stats = computed(() => changes.value.reduce((sum, change) => {
  const diff = getDiffStats(change.before.content, change.after.content)
  return { files: sum.files + 1, additions: sum.additions + diff.additions, deletions: sum.deletions + diff.deletions }
}, { files: 0, additions: 0, deletions: 0 }))

async function load() {
  if (!chat.currentId) {
    changes.value = []
    return
  }
  loading.value = true
  try {
    changes.value = await window.api.changes.list({ conversationId: chat.currentId }) as Change[]
  } catch (error: any) {
    ElMessage.error(error.message)
  } finally {
    loading.value = false
  }
}

async function restore(change: Change) {
  if (!chat.currentId) return
  try {
    await window.api.changes.restoreFile({ changeId: change.latestChangeId, force: forceNext.value })
    forceNext.value = false
    ElMessage.success(`已撤回 ${change.path}`)
    await load()
  } catch (error: any) {
    if (!forceNext.value && /conflict/i.test(error.message)) {
      await ElMessageBox.confirm('文件在 Agent 修改后又被改过。仍要强制覆盖吗？', '撤回冲突', { type: 'warning' })
        .then(async () => { forceNext.value = true; await restore(change) })
        .catch(() => undefined)
    } else ElMessage.error(error.message)
  }
}

async function rollbackLatest() {
  if (chat.running) return
  try {
    await chat.rollbackLatestTurn(false)
    ElMessage.success('已撤回最近一轮文件与对话上下文')
    await load()
  } catch (error: any) {
    if (/conflict/i.test(error.message || '')) {
      await ElMessageBox.confirm('检测到文件已被外部修改。仍要强制回退最近一轮吗？', '回退冲突', { type: 'warning' })
        .then(async () => { await chat.rollbackLatestTurn(true); await load(); ElMessage.success('已强制回退最近一轮') })
        .catch(() => undefined)
    } else ElMessage.error(error.message)
  }
}

async function restoreAll() {
  if (!changes.value.length) return
  try {
    await ElMessageBox.confirm('这会撤回本次会话记录的所有文件变更，确定继续吗？', '撤回会话修改', { type: 'warning' })
    await window.api.changes.restoreBatch({ changeIds: changes.value.map((change) => change.latestChangeId), force: false })
    ElMessage.success('已撤回会话修改')
    await load()
  } catch (error: any) {
    if (error !== 'cancel' && !/cancel/i.test(error?.message || '')) {
      if (/conflict/i.test(error.message || '')) {
        await ElMessageBox.confirm('检测到外部修改。仍要强制撤回全部会话文件吗？', '撤回冲突', { type: 'warning' })
          .then(async () => { await window.api.changes.restoreBatch({ changeIds: changes.value.map((change) => change.latestChangeId), force: true }); await load(); ElMessage.success('已强制撤回全部会话修改') })
          .catch(() => undefined)
      } else ElMessage.error(error.message || String(error))
    }
  }
}

async function openExternal(change: Change) {
  const target = (() => { try { return localStorage.getItem('codex_file_target') || '系统默认' } catch { return '系统默认' } })()
  const plain = (() => { try { return localStorage.getItem('codex_plain_editor') === 'true' } catch { return false } })()
  if (plain) {
    ElMessage.info(`纯文本模式：${change.path}`)
    return
  }
  try {
    const ws = chat.workspace
    if (!ws) { ElMessage.warning('未选择工作区'); return }
    await (window as any).api.fs.openWith(ws, change.path, target)
    ElMessage.success(`已用 ${target} 打开 ${change.path}`)
  } catch (e: any) {
    ElMessage.error(e.message || String(e))
  }
}

watch(() => chat.currentId, load)
onMounted(load)
</script>

<template>
  <section class="changes-panel">
    <header class="changes-head">
      <div><strong>会话改动</strong><span>{{ stats.files }} 个文件 · <b class="change-add">+{{ stats.additions }}</b> <b class="change-remove">-{{ stats.deletions }}</b></span></div>
      <div class="head-actions">
        <el-button text size="small" :disabled="chat.running" @click="rollbackLatest"><Icon icon="mdi:history" width="15" /> 回退最近一轮</el-button>
        <el-button text size="small" :disabled="!changes.length || chat.running" @click="restoreAll"><Icon icon="mdi:undo" width="15" /> 撤回全部</el-button>
      </div>
    </header>
    <div v-if="loading" class="changes-state">正在读取本次会话改动…</div>
    <div v-else-if="!changes.length" class="changes-state">本次会话还没有捕获到文件写入。</div>
    <div v-else class="change-list">
      <article v-for="change in changes" :key="change.path" class="change-row" :class="{ expanded: expandedPath === change.path }">
        <div class="change-entry">
          <button class="change-main" type="button" :aria-expanded="expandedPath === change.path" @click="expandedPath = expandedPath === change.path ? null : change.path" @dblclick="openExternal(change)" :title="`双击用 ${fileTargetLabel} 打开`">
            <Icon class="file-icon" :icon="fileIcon(change.path)" width="18" />
            <span class="file-copy">
              <strong>{{ fileName(change.path) }}</strong>
              <small>{{ parentPath(change.path) || '工作区根目录' }}</small>
            </span>
            <span class="change-stats"><b class="change-add">+{{ getDiffStats(change.before.content, change.after.content).additions }}</b><b class="change-remove">-{{ getDiffStats(change.before.content, change.after.content).deletions }}</b></span>
            <Icon class="entry-chevron" :class="{ open: expandedPath === change.path }" icon="mdi:chevron-right" width="18" />
          </button>
          <div class="change-toolbar">
            <span class="change-count">{{ change.changeCount }} 次变更</span>
            <el-button text size="small" :disabled="chat.running" @click="restore(change)">撤回</el-button>
          </div>
        </div>
        <el-collapse-transition>
          <div v-show="expandedPath === change.path" class="change-diff">
            <FileDiffView
              :before="change.before.content"
              :after="change.after.content"
              :path="change.path"
              :operation="change.operation"
              :hide-header="true"
            />
          </div>
        </el-collapse-transition>
      </article>
    </div>
  </section>
</template>

<style scoped>
.changes-panel { display: flex; flex-direction: column; height: 100%; min-height: 0; background: var(--panel-bg); }
.changes-head { display: flex; justify-content: space-between; align-items: center; padding: var(--space-3) var(--space-4); border-bottom: 1px solid var(--glass-border); }
.changes-head div { display: flex; flex-direction: column; gap: var(--space-1); }
.changes-head span { color: var(--text-secondary); font-size: 11px; }
.head-actions { display: flex; align-items: center; gap: 2px; }
.changes-state { padding: var(--space-6) var(--space-4); color: var(--text-secondary); font-size: 12px; line-height: 1.6; }
.change-list { overflow: auto; padding: var(--space-1) var(--space-3) var(--space-5); }
.change-row { border-bottom: 1px solid var(--glass-border); }
.change-entry { display: flex; align-items: center; min-height: 46px; padding: 0 var(--space-2) 0 var(--space-3); }
.change-main { display: flex; align-items: center; gap: var(--space-2); min-width: 0; flex: 1; padding: var(--space-2) 0; border: 0; color: var(--text-primary); background: transparent; cursor: pointer; text-align: left; }
.change-main:hover { color: var(--accent); }
.file-icon { flex: 0 0 auto; color: var(--accent); }
.file-copy { display: flex; flex: 1; min-width: 0; align-items: baseline; gap: var(--space-2); }
.file-copy strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font: 14px 'Cascadia Code', Consolas, monospace; font-weight: 600; }
.file-copy small { overflow: hidden; color: var(--text-faint); text-overflow: ellipsis; white-space: nowrap; font-size: 12px; }
.change-stats { display: flex; gap: var(--space-2); flex: 0 0 auto; font: 13px 'Cascadia Code', Consolas, monospace; }
.change-add { color: var(--diff-add); font-weight: 500; }
.change-remove { color: var(--diff-remove); font-weight: 500; }
.entry-chevron { flex: 0 0 auto; color: var(--text-faint); transition: transform 160ms ease; }
.entry-chevron.open { transform: rotate(90deg); }
.change-toolbar { display: flex; align-items: center; gap: var(--space-1); flex: 0 0 auto; }
.change-count { color: var(--text-faint); font-size: 11px; white-space: nowrap; }
.change-diff { margin: 0 var(--space-3) var(--space-3); border: 1px solid var(--glass-border); }
</style>
