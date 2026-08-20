<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { Icon } from '@iconify/vue'
import { ElMessage } from 'element-plus'
import EmptyState from '@/components/EmptyState.vue'
import SkeletonCard from '@/components/SkeletonCard.vue'
import { useChatStore } from '@/stores/chat'
import { useGithubStore } from '@/stores/github'
import type { Conversation, Project } from '@/types'

const router = useRouter()
const chat = useChatStore()
const github = useGithubStore()

const workspaceName = computed(() => chat.workspace?.split(/[\\/]/).filter(Boolean).pop() || '2027-harness')
const sortedConversations = computed(() => [...chat.conversations].sort((l, r) => (r.updatedAt || r.createdAt) - (l.updatedAt || l.createdAt)))
const activeProjects = computed(() => chat.projects.filter(p => !p.archivedAt).sort((l, r) => r.updatedAt - l.updatedAt))
const groupedProjects = computed(() => activeProjects.value.map(p => ({
  project: p,
  conversations: sortedConversations.value.filter(c => c.projectId === p.id).slice(0, 4)
})))
const recentConversations = computed(() => sortedConversations.value.slice(0, 7))

async function pickWorkspace() {
  const path = await window.api.dialog.pickDir()
  if (!path) return
  await chat.selectWorkspace(path)
}
function isExpanded(project: Project) { return chat.expandedProjectIds.includes(project.id) }
function formatShortId(id: string) { return id.slice(0, 7) }
function formatTime(ts: number) {
  const d = new Date(ts)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}
function shortTitle(c: Conversation) {
  const t = c.title?.trim() || '新对话'
  return t.length > 18 ? t.slice(0, 18) + '…' : t
}
</script>

<template>
  <section class="codex-sidebar">
    <!-- 顶部 Codex 头 -->
    <header class="codex-head">
      <div class="codex-brand">
        <span class="brand">Codex</span>
        <Icon icon="mdi:chevron-down" width="14" class="brand-chevron" />
      </div>
      <div class="head-actions">
        <button class="head-icon" title="搜索"><Icon icon="mdi:magnify" width="16" /></button>
        <button class="head-icon head-icon--bell" title="通知"><Icon icon="mdi:bell-outline" width="16" /><span class="blue-dot" /></button>
      </div>
    </header>

    <!-- 主导航 -->
    <nav class="main-nav">
      <button class="nav-row" @click="chat.newConversation()"><Icon icon="mdi:square-edit-outline" width="16" /><span>新对话</span></button>
      <button class="nav-row" @click="chat.newConversation()"><Icon icon="mdi:source-pull" width="16" /><span>拉取请求</span><span v-if="github.prs.length" class="nav-count">{{ github.prs.length }}</span></button>
      <button class="nav-row" @click="ElMessage && ElMessage.info('已安排为空')"><Icon icon="mdi:clock-outline" width="16" /><span>已安排</span></button>
      <button class="nav-row" @click="router.push('/settings')"><Icon icon="mdi:puzzle-outline" width="16" /><span>插件</span></button>
    </nav>

    <!-- 项目 -->
    <section class="side-section">
      <div class="side-title">项目</div>
      <div v-for="g in groupedProjects.slice(0,1)" :key="g.project.id" class="project-block">
        <button class="project-folder active" @click="chat.selectProject(g.project.id)">
          <Icon icon="mdi:folder-outline" width="16" />
          <span>{{ g.project.name || '2027-harness' }}</span>
        </button>
        <div class="project-items">
          <button
            v-for="c in (g.conversations.length ? g.conversations : sortedConversations.slice(0,4))"
            :key="c.id"
            class="proj-item"
            :class="{ active: c.id === chat.currentId }"
            @click="chat.select(c.id)"
          >
            <span class="item-meta">[{{ formatShortId(c.id) }} {{ formatTime(c.updatedAt || c.createdAt) }}]</span>
            <span class="item-title">{{ shortTitle(c) }}</span>
          </button>
          <button v-if="!g.conversations.length && !sortedConversations.length" class="proj-item" @click="pickWorkspace">
            <span class="item-meta">[空]</span><span class="item-title">选择工作区后显示</span>
          </button>
        </div>
      </div>
      <div v-if="!groupedProjects.length" class="project-block">
        <button class="project-folder" @click="pickWorkspace"><Icon icon="mdi:folder-outline" width="16" /><span>{{ workspaceName }}</span></button>
      </div>
    </section>

    <!-- 最近 -->
    <section class="side-section side-section--recent">
      <div class="side-title">最近</div>
      <div class="recent-list">
        <button
          v-for="c in recentConversations"
          :key="c.id"
          class="recent-row"
          :class="{ active: c.id === chat.currentId }"
          @click="chat.select(c.id)"
        >
          <span class="item-meta">[{{ formatShortId(c.id) }} {{ formatTime(c.updatedAt || c.createdAt) }}]</span>
          <span class="item-title">{{ shortTitle(c) }}</span>
          <span v-if="c.id === chat.currentId" class="recent-dot" />
        </button>
        <EmptyState v-if="!recentConversations.length && chat.hydrated" title="暂无最近" desc="创建任务后显示" />
        <SkeletonCard v-if="!chat.hydrated" :rows="3" />
      </div>
    </section>

    <footer class="sidebar-custom-entry">
      <button type="button" class="custom-btn" @click="router.push('/settings')">
        <Icon icon="mdi:cog-outline" width="16" />
        <span>custom</span>
      </button>
      <button type="button" class="help-btn" title="帮助"><Icon icon="mdi:help-circle-outline" width="16" /></button>
    </footer>
  </section>
</template>

<style scoped>
.codex-sidebar { display: flex; flex: 1 1 auto; min-width: 0; min-height: 0; flex-direction: column; overflow: hidden; background: #f3f7f7; color: #334155; }
.codex-head {
  height: 36px; display: flex; align-items: center; justify-content: space-between;
  padding: 0 10px; border-bottom: 1px solid #e6eef3; flex: 0 0 auto;
}
.codex-brand { display: inline-flex; align-items: center; gap: 4px; font-size: 14px; font-weight: 700; color: #0f172a; }
.brand-chevron { color: #94a3b8; }
.head-actions { display: inline-flex; gap: 6px; }
.head-icon {
  position: relative; display: grid; place-items: center; width: 26px; height: 26px;
  border: 0; border-radius: 6px; background: transparent; color: #64748b; cursor: pointer;
}
.head-icon:hover { background: rgba(255,255,255,0.7); color: #0f172a; }
.head-icon--bell .blue-dot { position: absolute; top: 4px; right: 6px; width: 6px; height: 6px; border-radius: 50%; background: #0ea5e9; border: 1px solid #f3f7f7; }

.main-nav { padding: 8px 6px; display: flex; flex-direction: column; gap: 1px; border-bottom: 1px solid #e6eef3; flex: 0 0 auto; }
.nav-row {
  display: flex; align-items: center; gap: 8px; width: 100%; padding: 7px 8px;
  border: 0; border-radius: 6px; background: transparent; color: #334155; font-size: 13px; text-align: left; cursor: pointer;
}
.nav-row:hover { background: rgba(255,255,255,0.7); }
.nav-count { margin-left: auto; font-size: 11px; color: #94a3b8; }

.side-section { padding: 12px 6px 0; flex: 0 0 auto; }
.side-section--recent { flex: 1 1 auto; min-height: 0; display: flex; flex-direction: column; overflow: hidden; }
.side-title { padding: 6px 6px 4px; font-size: 12px; color: #94a3b8; font-weight: 600; }
.project-block { margin-bottom: 8px; }
.project-folder {
  display: flex; align-items: center; gap: 6px; width: 100%; padding: 7px 8px;
  border: 0; border-radius: 6px; background: #e8ecef; color: #1e293b; font-size: 13px; text-align: left; cursor: pointer;
}
.project-folder.active { background: #e8ecef; }
.project-items { padding: 4px 0 0 12px; display: flex; flex-direction: column; gap: 1px; }
.proj-item {
  display: flex; align-items: center; gap: 6px; width: 100%; padding: 5px 6px;
  border: 0; border-radius: 5px; background: transparent; color: #64748b; font-size: 12px; text-align: left; cursor: pointer;
}
.proj-item:hover { background: rgba(255,255,255,0.6); color: #334155; }
.proj-item.active { background: #e2eef5; color: #0f172a; }
.item-meta { flex: 0 0 auto; font-size: 11px; color: #94a3b8; font-family: 'Cascadia Code', Consolas, monospace; }
.item-title { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.recent-list { flex: 1 1 auto; min-height: 0; overflow: auto; display: flex; flex-direction: column; gap: 1px; padding-right: 2px; }
.recent-row {
  display: flex; align-items: center; gap: 6px; width: 100%; padding: 6px 6px;
  border: 0; border-radius: 5px; background: transparent; color: #64748b; font-size: 12px; text-align: left; cursor: pointer;
}
.recent-row:hover { background: rgba(255,255,255,0.6); color: #334155; }
.recent-row.active { background: #e2eef5; color: #0f172a; }
.recent-dot { width: 6px; height: 6px; border-radius: 50%; background: #0ea5e9; flex: 0 0 auto; margin-left: auto; }

.sidebar-custom-entry {
  flex: 0 0 auto; display: flex; align-items: center; justify-content: space-between;
  gap: 8px; padding: 10px 12px; border-top: 1px solid #e6eef3; background: #f3f7f7;
}
.custom-btn { display: inline-flex; align-items: center; gap: 6px; padding: 6px 8px; border: 0; border-radius: 6px; background: transparent; color: #475569; font-size: 12px; cursor: pointer; }
.custom-btn:hover { background: rgba(255,255,255,0.7); color: #0f172a; }
.help-btn { display: grid; place-items: center; width: 26px; height: 26px; border: 0; border-radius: 50%; background: transparent; color: #94a3b8; cursor: pointer; }
.help-btn:hover { background: rgba(255,255,255,0.7); color: #475569; }
</style>
