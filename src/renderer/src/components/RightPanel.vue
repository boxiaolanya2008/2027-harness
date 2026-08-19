<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { Icon } from '@iconify/vue'
import dayjs from 'dayjs'
import EmptyState from '@/components/EmptyState.vue'
import SkeletonCard from '@/components/SkeletonCard.vue'
import { useChatStore } from '@/stores/chat'
import { useGithubStore } from '@/stores/github'
import { useSettingsStore } from '@/stores/settings'
import { chatOnce } from '@/api/openai'
import SessionChangesPanel from './SessionChangesPanel.vue'
import GitTimelinePanel from './GitTimelinePanel.vue'
import { parseGithubRemote } from '@/utils/githubRemote'

const chat = useChatStore()
const github = useGithubStore()
const settings = useSettingsStore()
const tab = computed({
  get: () => chat.rightPanelTab,
  set: (value: string) => {
    chat.rightPanelTab = value
    void chat.persistUiState()
  }
})
const panelTitle = computed(() => {
  if (tab.value === 'changes') return '会话改动'
  if (tab.value === 'pr') return 'Pull Request'
  if (tab.value === 'issue') return 'Issue'
  return '本地 Git'
})
const prBusy = ref(false)
const originFullName = ref<string | null>(null)
const bindNote = ref('')
const binding = ref(false)
let bindSeq = 0

async function bindWorkspaceRepo() {
  const seq = ++bindSeq
  binding.value = true
  originFullName.value = null
  bindNote.value = ''
  try {
    const ws = chat.workspace
    if (ws) {
      try {
        const remote = await window.api.git.remote(ws)
        originFullName.value = parseGithubRemote(remote)?.fullName || null
      } catch {
        originFullName.value = null
      }
    }
    if (seq !== bindSeq) return
    if (!settings.hasGithubToken) return

    await github.loadIdentity()
    await github.loadRepos()
    if (seq !== bindSeq) return

    const preferred = originFullName.value || chat.selectedRepoFullName
    if (!preferred) return
    const repo = await github.selectByFullName(preferred)
    if (seq !== bindSeq) return
    if (repo) {
      if (chat.selectedRepoFullName !== repo.full_name) {
        chat.selectedRepoFullName = repo.full_name
        await chat.persistUiState()
      }
      bindNote.value = ''
      return
    }
    if (originFullName.value) {
      bindNote.value = `本地 origin 是 ${originFullName.value}，GitHub 未能打开该仓库，请检查权限或手动选择。`
    }
  } finally {
    if (seq === bindSeq) binding.value = false
  }
}

watch([() => chat.workspace, () => settings.hasGithubToken], () => {
  void bindWorkspaceRepo()
}, { immediate: true })

function summarize(kind: string, item: any) {
  const body = item.body ? `\n正文：${item.body.slice(0, 1500)}` : ''
  chat.sendPrompt(`请帮我总结这个 ${kind}：\n#${item.number} ${item.title}${body}`)
}

async function oneClickPr() {
  const ws = chat.workspace
  if (!ws) {
    ElMessage.warning('先在左侧选择工作区')
    return
  }
  prBusy.value = true
  try {
    const diff = await window.api.git.diff(ws)
    const status = await window.api.git.status(ws)
    if (!diff && !status) {
      ElMessage.info('工作区没有未提交改动')
      return
    }
    const key = await window.api.settings.getAiKeyForRequest()
    const prompt = `根据以下 git diff 生成：1) 一句 commit message（中文，动词开头）2) PR title 3) PR body（中文，说明改动与动机）。只输出 JSON：{"message":"","title":"","body":""}\n\n${diff.slice(0, 6000)}`
    const raw = await chatOnce(settings.settings, key, [{ role: 'user', content: prompt }])
    const parsed = JSON.parse(raw.match(/\{[\s\S]*\}/)?.[0] || '{}')
    const branch = `super-agent/${Date.now().toString(36)}`
    await window.api.git.newBranch(ws, branch)
    await window.api.git.commitAll(ws, parsed.message || 'Super-Agent: auto commit')
    await window.api.git.push(ws, branch)

    const remote = await window.api.git.remote(ws)
    const origin = parseGithubRemote(remote)
    if (!origin) throw new Error('无法从 remote 解析 GitHub 仓库')
    const pr = await window.api.gh.post(`/repos/${origin.owner}/${origin.repo}/pulls`, {
      title: parsed.title || 'Super-Agent PR',
      head: branch,
      base: github.currentRepo?.default_branch || 'main',
      body: parsed.body || ''
    })
    ElMessage.success(`PR 已创建：${pr.html_url}`)
  } catch (e: any) {
    ElMessage.error(e.message)
  } finally {
    prBusy.value = false
  }
}
</script>

<template>
  <aside class="details-panel">
    <header class="details-head">
      <div>
        <h2>{{ panelTitle }}</h2>
        <span v-if="github.identity">@{{ github.identity.login }}</span>
        <span v-else-if="originFullName">{{ originFullName }}</span>
      </div>
      <Icon icon="mdi:github" width="18" />
    </header>

    <section class="tab-launcher">
      <div class="launcher-copy">
        <h3>打开标签页</h3>
        <p>选择要在侧边面板中打开的标签。</p>
      </div>
      <div class="picker-grid">
        <button type="button" :class="{ active: tab === 'github' }" @click="tab = 'github'">
          <Icon icon="mdi:source-commit" width="26" />
          <span>本地 Git</span>
        </button>
        <button type="button" :class="{ active: tab === 'pr' }" @click="tab = 'pr'">
          <Icon icon="mdi:source-pull" width="26" />
          <span>Pull Request</span>
        </button>
        <button type="button" :class="{ active: tab === 'issue' }" @click="tab = 'issue'">
          <Icon icon="mdi:alert-circle-outline" width="26" />
          <span>Issue</span>
        </button>
        <button type="button" :class="{ active: tab === 'changes' }" @click="tab = 'changes'">
          <Icon icon="mdi:file-document-edit-outline" width="26" />
          <span>会话改动</span>
        </button>
      </div>
    </section>

    <div v-show="tab === 'github'" class="panel-body">
      <GitTimelinePanel v-if="chat.workspace" />
      <EmptyState v-else title="未选择工作区" desc="在左侧打开本地目录后，这里会显示本仓库的提交。" />
    </div>

    <div v-show="tab === 'pr'" class="panel-body panel-body--list">
      <p v-if="originFullName" class="repo-caption">{{ originFullName }}</p>
      <template v-if="settings.hasGithubToken && github.currentRepo">
        <SkeletonCard v-if="github.loading" :rows="3" />
        <EmptyState v-else-if="!github.prs.length" title="没有 PR" desc="当前仓库还没有 pull request。" />
        <div v-else class="repo-list">
          <article v-for="pr in github.prs.slice(0, 30)" :key="pr.number" class="repo-row">
            <div class="row-title">#{{ pr.number }} {{ pr.title }}</div>
            <div class="row-meta">{{ pr.state }} · {{ dayjs(pr.created_at).format('MM-DD') }}</div>
            <button class="ai-action" @click="summarize('PR', pr)"><Icon icon="mdi:robot-outline" width="14" /> AI 总结</button>
          </article>
        </div>
        <div class="detail-actions"><el-button type="primary" :loading="prBusy" @click="oneClickPr"><Icon icon="mdi:source-pull" width="15" /> 一键生成并推送 PR</el-button></div>
      </template>
      <SkeletonCard v-else-if="github.loading || binding" :rows="3" />
      <EmptyState v-else-if="!settings.hasGithubToken" title="未连接 GitHub" :desc="originFullName ? `已从本地 origin 检测到 ${originFullName}。到设置连接 GitHub 后即可查看 PR。` : '到设置页面配置 token 后，这里会显示当前仓库的 PR。'" />
      <EmptyState v-else :title="originFullName ? '未能打开当前仓库' : '当前工作区不是 GitHub 仓库'" :desc="bindNote || '会读取本仓库 origin，不再手动选择。'" />
    </div>

    <div v-show="tab === 'issue'" class="panel-body panel-body--list">
      <p v-if="originFullName" class="repo-caption">{{ originFullName }}</p>
      <template v-if="settings.hasGithubToken && github.currentRepo">
        <SkeletonCard v-if="github.loading" :rows="3" />
        <EmptyState v-else-if="!github.issues.length" title="没有 Issue" desc="当前仓库还没有 issue。" />
        <div v-else class="repo-list">
          <article v-for="issue in github.issues.slice(0, 30)" :key="issue.number" class="repo-row">
            <div class="row-title">#{{ issue.number }} {{ issue.title }}</div>
            <div class="row-meta">{{ issue.state }} · {{ dayjs(issue.created_at).format('MM-DD') }}</div>
            <button class="ai-action" @click="summarize('Issue', issue)"><Icon icon="mdi:robot-outline" width="14" /> AI 总结</button>
          </article>
        </div>
      </template>
      <SkeletonCard v-else-if="github.loading || binding" :rows="3" />
      <EmptyState v-else-if="!settings.hasGithubToken" title="未连接 GitHub" :desc="originFullName ? `已从本地 origin 检测到 ${originFullName}。到设置连接 GitHub 后即可查看 Issue。` : '到设置页面配置 token 后，这里会显示当前仓库的 Issue。'" />
      <EmptyState v-else :title="originFullName ? '未能打开当前仓库' : '当前工作区不是 GitHub 仓库'" :desc="bindNote || '会读取本仓库 origin，不再手动选择。'" />
    </div>
    <div v-show="tab === 'changes'" class="panel-body panel-body--changes">
      <SessionChangesPanel />
    </div>
  </aside>
</template>

<style scoped>
.details-panel { height: 100%; min-width: 0; min-height: 0; display: flex; flex-direction: column; overflow: hidden; background: var(--panel-bg); border-left: 1px solid var(--glass-border); }
.details-head { height: var(--topbar-height); flex: 0 0 var(--topbar-height); display: flex; align-items: center; justify-content: space-between; padding: 0 12px; border-bottom: 1px solid var(--glass-border); background: var(--panel-bg); }
.details-head h2 { margin: 0; font-size: 13px; font-weight: 600; }
.details-head span { color: var(--text-secondary); font-size: 12px; }
.tab-launcher { flex: 0 0 auto; padding: 18px 16px 8px; }
.launcher-copy { margin-bottom: 14px; text-align: center; }
.launcher-copy h3 { margin: 0 0 6px; color: var(--text-primary); font-size: 16px; font-weight: 650; }
.launcher-copy p { margin: 0; color: var(--text-faint); font-size: 12px; }
.picker-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--space-2); }
.picker-grid button { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: var(--space-2); min-height: calc(72px * var(--ui-space-scale)); padding: var(--space-3) var(--space-2); border: 1px solid var(--glass-border); border-radius: 12px; color: var(--text-secondary); background: var(--surface-bg); cursor: pointer; }
.picker-grid button:hover { color: var(--text-primary); border-color: var(--accent); background: var(--hover-bg); }
.picker-grid button.active { color: var(--text-primary); border-color: var(--accent); background: color-mix(in srgb, var(--accent) 10%, var(--surface-bg)); }
.picker-grid span { font-size: 12px; }
.panel-body { display: flex; flex: 1 1 auto; min-height: 0; min-width: 0; flex-direction: column; overflow: hidden; }
.panel-body--changes, .panel-body--list { min-height: 0; overflow: hidden; }
.panel-body--changes :deep(.changes-panel), .panel-body--changes :deep(.change-list) { flex: 1 1 auto; min-height: 0; overscroll-behavior: contain; }
.repo-caption { flex: 0 0 auto; margin: 0; padding: var(--space-3) var(--space-4) var(--space-2); color: var(--text-secondary); font-size: 12px; }
.repo-list { flex: 1 1 auto; min-height: 0; overflow: auto; padding: 0 var(--space-4); }
.repo-row { padding: var(--space-3) var(--space-1); border-bottom: 1px solid var(--glass-border); }
.repo-row:hover { background: var(--hover-bg); }
.row-title { color: var(--text-primary); font-size: 13px; line-height: 1.45; }
.row-meta { margin-top: var(--space-1); color: var(--text-faint); font-size: 11px; }
.ai-action { display: inline-flex; align-items: center; gap: 5px; margin-top: var(--space-2); padding: 0; border: 0; color: var(--accent); background: transparent; cursor: pointer; font-size: 12px; }
.ai-action:hover { opacity: 0.82; }
.detail-actions { flex: 0 0 auto; padding: var(--space-3) var(--space-4); border-top: 1px solid var(--glass-border); }
.detail-actions :deep(.el-button) { width: 100%; }
</style>
