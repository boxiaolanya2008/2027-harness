<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { Icon } from '@iconify/vue'
import dayjs from 'dayjs'
import GlassCard from '@/components/GlassCard.vue'
import EmptyState from '@/components/EmptyState.vue'
import SkeletonCard from '@/components/SkeletonCard.vue'
import TimelineView from '@/components/TimelineView.vue'
import { useChatStore } from '@/stores/chat'
import { useGithubStore } from '@/stores/github'
import { useIndexerStore } from '@/stores/indexer'
import { useSettingsStore } from '@/stores/settings'
import { chatOnce } from '@/api/openai'
import type { SearchHit } from '@/types'

const chat = useChatStore()
const github = useGithubStore()
const indexer = useIndexerStore()
const settings = useSettingsStore()

const tab = ref<'pr' | 'issue' | 'commit'>('pr')
const ragQuery = ref('')
const prBusy = ref(false)

onMounted(async () => {
  if (settings.hasGithubToken) {
    await github.loadIdentity()
    await github.loadRepos()
  }
})

async function pickWorkspace() {
  const dir = await window.api.dialog.pickDir()
  if (dir) {
    chat.workspace = dir
    await indexer.check(dir)
  }
}

async function buildIndex() {
  if (!chat.workspace) return
  await indexer.build(chat.workspace)
  ElMessage.success(`索引完成：${indexer.fileCount} 个文件`)
}

async function doRagSearch() {
  if (!chat.workspace || !ragQuery.value.trim()) return
  await indexer.search(chat.workspace, ragQuery.value.trim())
}

async function askCodebase(hit: SearchHit) {
  chat.sendPrompt(
    `（来自代码库检索）文件 ${hit.file} 命中：\n\`\`\`\n${hit.snippet.slice(0, 1200)}\n\`\`\`\n请结合这段代码回答我的问题。`
  )
}

function summarize(kind: string, item: any) {
  const body = item.body ? `\n正文：${item.body.slice(0, 1500)}` : ''
  chat.sendPrompt(`请帮我总结这个 ${kind}：\n#${item.number} ${item.title}${body}`)
}

async function oneClickPr() {
  const ws = chat.workspace
  if (!ws) {
    ElMessage.warning('先选择工作区')
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
    const m = remote.match(/github\.com[:/]([^/]+)\/([^/]+?)(?:\.git)?$/)
    if (!m) throw new Error('无法从 remote 解析 GitHub 仓库')
    const owner = m[1]
    const repo = m[2]
    const pr = await window.api.gh.post(`/repos/${owner}/${repo}/pulls`, {
      title: parsed.title || 'Super-Agent PR',
      head: branch,
      base: 'main',
      body: parsed.body || ''
    })
    ElMessage.success(`PR 已创建：${pr.html_url}`)
    await github.selectRepo({ ...github.currentRepo!, full_name: `${owner}/${repo}` })
  } catch (e: any) {
    ElMessage.error(e.message)
  } finally {
    prBusy.value = false
  }
}
</script>

<template>
  <div class="right-panel">
    <GlassCard class="panel-card" :interactive="false">
      <div class="card-head">
        <span>工作区</span>
        <el-button text size="small" @click="pickWorkspace">
          <Icon icon="mdi:folder-open" width="15" />
        </el-button>
      </div>
      <div class="workspace-path">{{ chat.workspace || '未选择目录' }}</div>
      <template v-if="chat.workspace">
        <el-button size="small" :loading="indexer.indexing" @click="buildIndex">
          {{ indexer.hasIndex ? '重建索引' : '建立代码库索引' }}
        </el-button>
        <div v-if="indexer.hasIndex" class="rag">
          <el-input v-model="ragQuery" placeholder="问代码库…" @keyup.enter="doRagSearch" />
          <div v-if="indexer.hits.length" class="rag-hits">
            <button v-for="h in indexer.hits" :key="h.file + h.score" class="rag-hit" @click="askCodebase(h)">
              <div class="rag-file">{{ h.file }}</div>
              <div class="rag-snippet">{{ h.snippet.slice(0, 80) }}</div>
            </button>
          </div>
        </div>
      </template>
      <EmptyState v-else title="还没有工作区" desc="选一个本地代码目录，我才能读文件、改代码、跑命令。" />
    </GlassCard>

    <GlassCard class="panel-card github-card" :interactive="false">
      <div class="card-head">
        <span>GitHub</span>
        <span v-if="github.identity" class="gh-user">@{{ github.identity.login }}</span>
      </div>

      <template v-if="!settings.hasGithubToken">
        <EmptyState title="未连接 GitHub" desc="到设置里填入 token。" />
      </template>

      <template v-else>
        <el-select
          v-model="github.currentRepo"
          value-key="id"
          placeholder="选择仓库"
          filterable
          size="small"
          class="repo-select"
          @change="github.selectRepo"
        >
          <el-option v-for="r in github.repos" :key="r.id" :label="r.full_name" :value="r" />
        </el-select>

        <el-tabs v-if="github.currentRepo" v-model="tab" size="small">
          <el-tab-pane label="PR" name="pr">
            <SkeletonCard v-if="github.loading" :rows="3" />
            <EmptyState v-else-if="!github.prs.length" title="没有 PR" desc="这个仓库还没有 pull request。" />
            <div v-else class="item-list">
              <div v-for="p in github.prs.slice(0, 30)" :key="p.number" class="item glass-card">
                <div class="item-title">#{{ p.number }} {{ p.title }}</div>
                <div class="item-meta">{{ p.state }} · {{ dayjs(p.created_at).format('MM-DD') }}</div>
                <el-button text size="small" @click.stop="summarize('PR', p)">
                  <Icon icon="mdi:robot-outline" width="14" /> AI 总结
                </el-button>
              </div>
            </div>
          </el-tab-pane>

          <el-tab-pane label="Issue" name="issue">
            <SkeletonCard v-if="github.loading" :rows="3" />
            <EmptyState v-else-if="!github.issues.length" title="没有 Issue" desc="这个仓库还没有 issue。" />
            <div v-else class="item-list">
              <div v-for="i in github.issues.slice(0, 30)" :key="i.number" class="item glass-card">
                <div class="item-title">#{{ i.number }} {{ i.title }}</div>
                <div class="item-meta">{{ i.state }} · {{ dayjs(i.created_at).format('MM-DD') }}</div>
                <el-button text size="small" @click.stop="summarize('Issue', i)">
                  <Icon icon="mdi:robot-outline" width="14" /> AI 总结
                </el-button>
              </div>
            </div>
          </el-tab-pane>

          <el-tab-pane label="提交时间线" name="commit">
            <SkeletonCard v-if="github.loading" :rows="3" />
            <EmptyState v-else-if="!github.commits.length" title="没有提交" desc="" />
            <TimelineView
              v-else
              :nodes="github.commits.slice(0, 40).map((c) => ({
                id: c.sha,
                title: c.commit.message.split('\n')[0],
                subtitle: c.commit.author.name,
                time: c.commit.author.date,
                icon: 'mdi:source-commit'
              }))"
            />
          </el-tab-pane>
        </el-tabs>

        <el-button
          v-if="chat.workspace && github.currentRepo"
          class="pr-btn"
          type="primary"
          size="small"
          :loading="prBusy"
          @click="oneClickPr"
        >
          <Icon icon="mdi:source-pull" width="14" /> 一键生成并推送 PR
        </el-button>
      </template>
    </GlassCard>
  </div>
</template>

<style scoped>
.right-panel {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}
.panel-card {
  padding: var(--space-4);
}
.card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 13px;
  font-weight: 600;
  margin-bottom: var(--space-3);
}
.gh-user {
  color: var(--text-secondary);
}
.workspace-path {
  font-size: 12px;
  color: var(--text-secondary);
  word-break: break-all;
  margin-bottom: var(--space-3);
}
.rag {
  margin-top: var(--space-3);
}
.rag-hits {
  margin-top: var(--space-2);
}
.rag-hit {
  width: 100%;
  text-align: left;
  background: var(--hover-bg);
  border: none;
  border-radius: var(--radius-sm);
  padding: var(--space-2);
  margin-bottom: var(--space-2);
  cursor: pointer;
}
.rag-hit:hover {
  background: var(--hover-bg);
}
.rag-file {
  font-family: 'Cascadia Code', Consolas, monospace;
  font-size: 12px;
}
.rag-snippet {
  font-size: 11px;
  color: var(--text-secondary);
}
.repo-select {
  width: 100%;
}
.item-list {
  display: flex;
  flex-direction: column;
}
.item {
  padding: var(--space-3);
}
.item-title {
  font-size: 13px;
}
.item-meta {
  font-size: 11px;
  color: var(--text-faint);
}
.pr-btn {
  width: 100%;
}
</style>
