<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Icon } from '@iconify/vue'
import FileDiffView from './FileDiffView.vue'
import { useChatStore } from '@/stores/chat'
import { getDiffStats, type DiffStats } from '@/utils/fileDiff'

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
const expanded = ref<string | null>(null)
const forceNext = ref(false)

const stats = computed(() => changes.value.reduce((sum, change) => {
  const diff = getDiffStats(change.before.content, change.after.content)
  return { files: sum.files + 1, additions: sum.additions + diff.additions, deletions: sum.deletions + diff.deletions }
}, { files: 0, additions: 0, deletions: 0 }))
const changeStats = (change: Change): DiffStats => getDiffStats(change.before.content, change.after.content)

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
      <article v-for="change in changes" :key="change.path" class="change-row">
        <button class="change-main" @click="expanded = expanded === change.path ? null : change.path">
          <Icon :icon="expanded === change.path ? 'mdi:chevron-down' : 'mdi:chevron-right'" width="16" />
          <span class="file-name">{{ change.path }}</span>
          <span class="file-op" :class="`file-op--${change.operation}`">{{ change.operation }}</span>
          <span class="change-diff-stats">(+{{ changeStats(change).additions }} -{{ changeStats(change).deletions }})</span>
        </button>
        <div class="change-actions">
          <span class="change-count">{{ change.changeCount }} 次</span>
          <el-button text size="small" :disabled="chat.running" @click="restore(change)">撤回</el-button>
        </div>
        <FileDiffView
          v-if="expanded === change.path"
          :before="change.before.content"
          :after="change.after.content"
          :path="change.path"
          :operation="change.operation"
        />
      </article>
    </div>
  </section>
</template>

<style scoped>
.changes-panel { display: flex; flex-direction: column; height: 100%; min-height: 0; background: var(--panel-bg); }
.changes-head { display: flex; justify-content: space-between; align-items: center; padding: 14px; border-bottom: 1px solid var(--glass-border); }
.changes-head div { display: flex; flex-direction: column; gap: 4px; }
.changes-head span { color: var(--text-secondary); font-size: 11px; }
.head-actions { display: flex; align-items: center; gap: 2px; }
.changes-state { padding: 28px 16px; color: var(--text-secondary); font-size: 12px; line-height: 1.6; }
.change-list { overflow: auto; padding: 4px 12px 20px; }
.change-row { padding: 10px 0; border-bottom: 1px solid var(--glass-border); }
.change-main { display: flex; align-items: center; width: calc(100% - 60px); gap: 5px; border: 0; color: var(--text-primary); background: transparent; cursor: pointer; text-align: left; }
.file-name { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font: 12px 'Cascadia Code', Consolas, monospace; }
.file-op { flex: 0 0 auto; font-size: 10px; color: var(--accent); }
.file-op--delete { color: #d95757; }
.change-actions { display: flex; align-items: center; justify-content: flex-end; gap: 4px; margin-top: 4px; }
.change-count { color: var(--text-faint); font-size: 10px; }
.change-diff-stats { flex: 0 0 auto; color: var(--text-secondary); font-size: 10px; }
.change-add { color: var(--diff-add); font-weight: 500; }
.change-remove { color: var(--diff-remove); font-weight: 500; }
</style>
