<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { Icon } from '@iconify/vue'
import dayjs from 'dayjs'
import EmptyState from '@/components/EmptyState.vue'
import SkeletonCard from '@/components/SkeletonCard.vue'
import TimelineView from '@/components/TimelineView.vue'
import { useChatStore } from '@/stores/chat'
import { useGithubStore } from '@/stores/github'
import { useSettingsStore } from '@/stores/settings'
import { chatOnce } from '@/api/openai'
import SessionChangesPanel from './SessionChangesPanel.vue'

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
const prBusy = ref(false)
const repoTab = ref<'pr' | 'issue' | 'commit'>('pr')

onMounted(async () => {
  if (!settings.hasGithubToken) return
  await github.loadIdentity()
  await github.loadRepos()
  const saved = github.repos.find((repo) => repo.full_name === chat.selectedRepoFullName)
  if (saved) await github.selectRepo(saved)
})

async function selectRepo(repo: any) {
  await github.selectRepo(repo)
  chat.selectedRepoFullName = repo?.full_name || null
  await chat.persistUiState()
}

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
    const key = (await window.api.settings.get()).aiKey
    const prompt = `根据以下 git diff 生成：1) 一句 commit message（中文，动词开头）2) PR title 3) PR body（中文，说明改动与动机）。只输出 JSON：{"message":"","title":"","body":""}\n\n${diff.slice(0, 6000)}`
    const raw = await chatOnce(settings.settings, key, [{ role: 'user', content: prompt }])
    const parsed = JSON.parse(raw.match(/\{[\s\S]*\}/)?.[0] || '{}')
    const branch = `super-agent/${Date.now().toString(36)}`
    await window.api.git.newBranch(ws, branch)
    await window.api.git.commitAll(ws, parsed.message || 'Super-Agent: auto commit')
    await window.api.git.push(ws, branch)

    const remote = await window.api.git.remote(ws)
    const match = remote.match(/github\.com[:/]([^/]+)\/([^/]+?)(?:\.git)?$/)
    if (!match) throw new Error('无法从 remote 解析 GitHub 仓库')
    const owner = match[1]
    const repo = match[2]
    const pr = await window.api.gh.post(`/repos/${owner}/${repo}/pulls`, {
      title: parsed.title || 'Super-Agent PR',
      head: branch,
      base: 'main',
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
        <h2>{{ tab === 'changes' ? '会话改动' : 'GitHub' }}</h2>
        <span v-if="github.identity">@{{ github.identity.login }}</span>
      </div>
      <Icon icon="mdi:github" width="18" />
    </header>

    <el-tabs v-model="tab" class="detail-tabs" stretch>
      <el-tab-pane label="GitHub" name="github">
        <template v-if="settings.hasGithubToken">
          <div class="repo-picker">
            <el-select v-model="github.currentRepo" value-key="id" placeholder="选择仓库" filterable @change="selectRepo">
              <el-option v-for="repo in github.repos" :key="repo.id" :label="repo.full_name" :value="repo" />
            </el-select>
          </div>
          <template v-if="github.currentRepo">
            <el-tabs v-model="repoTab" class="repo-tabs" stretch>
              <el-tab-pane label="PR" name="pr">
                <SkeletonCard v-if="github.loading" :rows="3" />
                <EmptyState v-else-if="!github.prs.length" title="没有 PR" desc="这个仓库还没有 pull request。" />
                <div v-else class="repo-list">
                  <article v-for="pr in github.prs.slice(0, 30)" :key="pr.number" class="repo-row">
                    <div class="row-title">#{{ pr.number }} {{ pr.title }}</div>
                    <div class="row-meta">{{ pr.state }} · {{ dayjs(pr.created_at).format('MM-DD') }}</div>
                    <button class="ai-action" @click="summarize('PR', pr)"><Icon icon="mdi:robot-outline" width="14" /> AI 总结</button>
                  </article>
                </div>
              </el-tab-pane>
              <el-tab-pane label="Issue" name="issue">
                <SkeletonCard v-if="github.loading" :rows="3" />
                <EmptyState v-else-if="!github.issues.length" title="没有 Issue" desc="这个仓库还没有 issue。" />
                <div v-else class="repo-list">
                  <article v-for="issue in github.issues.slice(0, 30)" :key="issue.number" class="repo-row">
                    <div class="row-title">#{{ issue.number }} {{ issue.title }}</div>
                    <div class="row-meta">{{ issue.state }} · {{ dayjs(issue.created_at).format('MM-DD') }}</div>
                    <button class="ai-action" @click="summarize('Issue', issue)"><Icon icon="mdi:robot-outline" width="14" /> AI 总结</button>
                  </article>
                </div>
              </el-tab-pane>
              <el-tab-pane label="提交" name="commit">
                <SkeletonCard v-if="github.loading" :rows="3" />
                <EmptyState v-else-if="!github.commits.length" title="没有提交" desc="这个仓库还没有可展示的提交。" />
                <TimelineView v-else :nodes="github.commits.slice(0, 40).map((commit) => ({ id: commit.sha, title: commit.commit.message.split('\n')[0], subtitle: commit.commit.author.name, time: commit.commit.author.date, icon: 'mdi:source-commit' }))" />
              </el-tab-pane>
            </el-tabs>
            <div class="detail-actions"><el-button type="primary" :loading="prBusy" @click="oneClickPr"><Icon icon="mdi:source-pull" width="15" /> 一键生成并推送 PR</el-button></div>
          </template>
          <EmptyState v-else-if="!github.loading" title="选择一个仓库" desc="选择后可以查看 PR、Issue 和提交记录。" />
        </template>
        <EmptyState v-else title="未连接 GitHub" desc="到设置页面配置 token 后，这里会显示真实仓库数据。" />
      </el-tab-pane>
      <el-tab-pane label="会话改动" name="changes"><SessionChangesPanel /></el-tab-pane>
    </el-tabs>
  </aside>
</template>

<style scoped>
.details-panel { height: 100%; min-height: 0; display: flex; flex-direction: column; background: var(--panel-bg); border-left: 1px solid var(--glass-border); }
.details-head { height: 54px; display: flex; align-items: center; justify-content: space-between; padding: 0 16px; border-bottom: 1px solid var(--glass-border); }
.details-head h2 { margin: 0; font-size: 14px; }
.details-head span { color: var(--text-secondary); font-size: 12px; }
.repo-picker { padding: 14px 14px 0; }
.repo-picker :deep(.el-select) { width: 100%; }
.repo-tabs { flex: 1; min-height: 0; padding: 0 14px; }
.repo-tabs :deep(.el-tabs__content) { height: calc(100% - 40px); overflow: auto; }
.repo-list { display: flex; flex-direction: column; }
.repo-row { padding: 12px 2px; border-bottom: 1px solid var(--glass-border); }
.row-title { color: var(--text-primary); font-size: 13px; line-height: 1.45; }
.row-meta { margin-top: 4px; color: var(--text-faint); font-size: 11px; }
.ai-action { display: inline-flex; align-items: center; gap: 5px; margin-top: 8px; padding: 0; border: 0; color: var(--accent); background: transparent; cursor: pointer; font-size: 12px; }
.detail-actions { padding: 14px 0; border-top: 1px solid var(--glass-border); }
.detail-actions :deep(.el-button) { width: 100%; }
</style>
