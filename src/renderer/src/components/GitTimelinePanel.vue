<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Icon } from '@iconify/vue'
import dayjs from 'dayjs'
import SkeletonCard from './SkeletonCard.vue'
import EmptyState from './EmptyState.vue'
import { useChatStore } from '@/stores/chat'
import { parseGithubRemote } from '@/utils/githubRemote'

interface Commit { hash: string; subject: string; author: string; date: string }
const chat = useChatStore()
const commits = ref<Commit[]>([])
const loading = ref(false)
const repoState = ref<'unknown' | 'repo' | 'none'>('unknown')
const branch = ref('')
const githubFullName = ref('')

async function load() {
  if (!chat.workspace) {
    repoState.value = 'none'
    commits.value = []
    branch.value = ''
    githubFullName.value = ''
    return
  }
  loading.value = true
  try {
    const out = await window.api.git.timeline(chat.workspace)
    commits.value = out.commits.map((commit: any) => ({
      hash: commit.sha,
      subject: commit.subject,
      author: commit.author,
      date: commit.date
    }))
    repoState.value = out.isRepo ? 'repo' : 'none'
    branch.value = out.branch || ''
    githubFullName.value = out.github?.fullName || parseGithubRemote(out.remote || '')?.fullName || ''
  } catch (error: any) {
    ElMessage.error(error.message)
  } finally {
    loading.value = false
  }
}
async function initRepo() {
  if (!chat.workspace) return
  await window.api.git.init(chat.workspace)
  ElMessage.success('已初始化本地 Git 仓库')
  await load()
}
async function publish() {
  if (!chat.workspace) return
  try {
    const { value } = await ElMessageBox.prompt('输入要创建的 GitHub 仓库名称', '发布到 GitHub', {
      inputPattern: /^[A-Za-z0-9_.-]+$/,
      inputErrorMessage: '仓库名只能包含字母、数字、点、下划线和短横线'
    })
    await window.api.git.publish(chat.workspace, value)
    ElMessage.success('已创建并发布到 GitHub')
    await load()
  } catch (error: any) {
    if (error !== 'cancel') ElMessage.error(error.message || String(error))
  }
}
watch(() => chat.workspace, load)
onMounted(load)
</script>

<template>
  <section class="git-panel">
    <header>
      <div>
        <strong>本地 Git</strong>
        <span v-if="repoState === 'repo'">{{ branch || '提交时间线' }}</span>
        <span v-if="githubFullName">{{ githubFullName }}</span>
      </div>
      <div>
        <el-button text size="small" :disabled="loading" @click="load"><Icon icon="mdi:refresh" width="15" /></el-button>
        <el-button v-if="repoState === 'repo'" text size="small" @click="publish">发布</el-button>
      </div>
    </header>
    <SkeletonCard v-if="loading" :rows="4" />
    <EmptyState v-else-if="!chat.workspace" title="未选择工作区" desc="选择目录后可查看本地 Git 历史。" />
    <EmptyState v-else-if="repoState === 'none'" title="还不是 Git 仓库" desc="初始化后可记录改动并展示提交时间线。">
      <el-button size="small" type="primary" @click="initRepo">初始化仓库</el-button>
    </EmptyState>
    <div v-else-if="commits.length" class="timeline">
      <article v-for="commit in commits" :key="commit.hash" class="commit">
        <span class="rail" />
        <div>
          <code>{{ commit.hash.slice(0, 7) }}</code>
          <p>{{ commit.subject }}</p>
          <small>{{ commit.author }} · {{ dayjs(commit.date).format('MM-DD HH:mm') }}</small>
        </div>
      </article>
    </div>
    <EmptyState v-else title="暂无提交" desc="完成首次提交后会显示在这里。" />
  </section>
</template>

<style scoped>
.git-panel {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  min-height: 0;
  overflow: auto;
  padding: var(--space-3) var(--space-4) var(--space-2);
  border-bottom: 0;
}
header { display: flex; align-items: center; justify-content: space-between; margin-bottom: var(--space-2); }
header > div { display: flex; align-items: center; gap: var(--space-2); min-width: 0; }
header strong { font-size: 13px; }
header span { overflow: hidden; color: var(--text-faint); text-overflow: ellipsis; white-space: nowrap; font-size: 11px; }
.timeline { padding: var(--space-1) 3px; }
.commit { position: relative; display: flex; gap: var(--space-3); padding: 0 0 var(--space-4); }
.rail {
  width: 9px;
  height: 9px;
  margin-top: 5px;
  border: 2px solid var(--accent);
  border-radius: 50%;
  background: var(--surface-bg);
  box-shadow: 0 0 0 3px var(--selected-bg);
}
.commit:not(:last-child)::before {
  content: '';
  position: absolute;
  top: 14px;
  left: 4px;
  width: 1px;
  height: calc(100% - 8px);
  background: var(--glass-border);
}
.commit code { color: var(--accent); font-size: 11px; }
.commit p { margin: 3px 0; color: var(--text-primary); font-size: 12px; line-height: 1.45; }
.commit small { color: var(--text-faint); font-size: 11px; }
</style>
