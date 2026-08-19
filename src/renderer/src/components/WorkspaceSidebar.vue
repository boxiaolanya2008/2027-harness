<script setup lang="ts">
import { computed } from 'vue'
import { Icon } from '@iconify/vue'
import EmptyState from '@/components/EmptyState.vue'
import SkeletonCard from '@/components/SkeletonCard.vue'
import { useChatStore } from '@/stores/chat'
import type { Conversation, Project } from '@/types'

const chat = useChatStore()
const workspaceName = computed(() => chat.workspace?.split(/[\\/]/).filter(Boolean).pop() || '选择工作区')
const sortedConversations = computed(() => [...chat.conversations].sort((left, right) => {
  const leftTime = left.updatedAt || left.createdAt
  const rightTime = right.updatedAt || right.createdAt
  return rightTime - leftTime
}))
const activeProjects = computed(() => chat.projects
  .filter((project) => !project.archivedAt)
  .sort((left, right) => right.updatedAt - left.updatedAt))
const ungroupedConversations = computed(() => sortedConversations.value.filter((conversation) => !conversation.projectId))
const groupedProjects = computed(() => activeProjects.value.map((project) => ({
  project,
  conversations: sortedConversations.value.filter((conversation) => conversation.projectId === project.id)
})))

async function pickWorkspace() {
  const path = await window.api.dialog.pickDir()
  if (!path) return
  await chat.selectWorkspace(path)
}

function isExpanded(project: Project) {
  return chat.expandedProjectIds.includes(project.id)
}

function formatConversationTime(conversation: Conversation) {
  const timestamp = conversation.updatedAt || conversation.createdAt
  const date = new Date(timestamp)
  const now = new Date()
  const sameDay = date.toDateString() === now.toDateString()
  return new Intl.DateTimeFormat('zh-CN', sameDay ? { hour: '2-digit', minute: '2-digit' } : { month: '2-digit', day: '2-digit' }).format(date)
}
</script>

<template>
  <section class="workspace-sidebar">
    <div class="workspace-section">
      <div class="section-head">
        <span>工作区</span>
        <button title="选择目录" @click="pickWorkspace"><Icon icon="mdi:folder-plus-outline" width="17" /></button>
      </div>
      <button class="workspace-heading" :title="chat.workspace || '选择工作区'" @click="pickWorkspace">
        <Icon icon="mdi:folder-open-outline" width="18" />
        <span class="workspace-heading-copy"><strong>{{ workspaceName }}</strong><small>{{ chat.workspace || '选择本地目录开始任务' }}</small></span>
        <Icon class="workspace-heading-action" icon="mdi:chevron-right" width="16" />
      </button>
      <SkeletonCard v-if="!chat.hydrated" :rows="3" />
      <div v-else class="workspace-list" aria-label="最近工作区">
        <button v-for="path in chat.workspaces" :key="path" class="workspace-row" :class="{ active: path === chat.workspace }" :title="path" @click="chat.selectWorkspace(path)">
          <Icon icon="mdi:folder-open-outline" width="16" /><span>{{ path.split(/[\\/]/).filter(Boolean).pop() }}</span>
        </button>
        <button v-if="!chat.workspaces.length" class="workspace-empty" @click="pickWorkspace"><Icon icon="mdi:folder-plus-outline" width="16" /> 选择本地目录</button>
      </div>
    </div>

    <section class="conversation-section">
      <div class="section-head conversation-heading"><span>任务</span><span class="conversation-count">{{ sortedConversations.length }}</span></div>
      <div class="conversation-list">
        <section v-for="group in groupedProjects" :key="group.project.id" class="project-group">
          <div class="project-head" :class="{ active: group.project.id === chat.selectedProjectId }">
            <button class="project-toggle" :title="isExpanded(group.project) ? '折叠项目' : '展开项目'" :aria-expanded="isExpanded(group.project)" @click="chat.toggleProjectExpanded(group.project.id)">
              <Icon :icon="isExpanded(group.project) ? 'mdi:chevron-down' : 'mdi:chevron-right'" width="16" />
            </button>
            <button class="project-select" :title="group.project.workspace" @click="chat.selectProject(group.project.id)">
              <Icon icon="mdi:folder-outline" width="16" /><span>{{ group.project.name }}</span><small>{{ group.conversations.length }}</small>
            </button>
            <button class="project-archive" title="归档项目" @click="chat.archiveProject(group.project.id)"><Icon icon="mdi:archive-outline" width="15" /></button>
          </div>
          <div v-if="isExpanded(group.project)" class="project-conversations">
            <button v-for="conversation in group.conversations" :key="conversation.id" class="conversation-row" :class="{ active: conversation.id === chat.currentId }" @click="chat.select(conversation.id)">
              <Icon class="conversation-icon" icon="mdi:message-text-outline" width="16" />
              <span class="conversation-copy"><strong>{{ conversation.title }}</strong></span>
              <span class="conversation-actions"><span class="conversation-time">{{ formatConversationTime(conversation) }}</span><span class="delete-action" title="删除任务" @click.stop="chat.remove(conversation.id)"><Icon icon="mdi:delete-outline" width="15" /></span></span>
            </button>
            <p v-if="!group.conversations.length" class="empty-group">尚无任务</p>
          </div>
        </section>

        <section v-if="ungroupedConversations.length" class="project-group ungrouped-group">
          <div class="project-head" :class="{ active: chat.selectedProjectId === null }">
            <button class="project-select" @click="chat.selectProject(null)"><Icon icon="mdi:message-outline" width="16" /><span>未分组</span><small>{{ ungroupedConversations.length }}</small></button>
          </div>
          <div class="project-conversations">
            <button v-for="conversation in ungroupedConversations" :key="conversation.id" class="conversation-row" :class="{ active: conversation.id === chat.currentId }" @click="chat.select(conversation.id)">
              <Icon class="conversation-icon" icon="mdi:message-text-outline" width="16" />
              <span class="conversation-copy"><strong>{{ conversation.title }}</strong></span>
              <span class="conversation-actions"><span class="conversation-time">{{ formatConversationTime(conversation) }}</span><span class="delete-action" title="删除任务" @click.stop="chat.remove(conversation.id)"><Icon icon="mdi:delete-outline" width="15" /></span></span>
            </button>
          </div>
        </section>
        <EmptyState v-if="!sortedConversations.length && !activeProjects.length && chat.hydrated" title="还没有项目或任务" desc="选择本地目录即可创建项目。" />
      </div>
    </section>

    <div class="sidebar-footer"><button class="new-task" @click="chat.newConversation()"><Icon icon="mdi:plus" width="18" /><span>新建任务</span></button></div>
  </section>
</template>

<style scoped>
.workspace-sidebar { display: flex; flex: 1 1 auto; min-width: 0; min-height: 0; flex-direction: column; overflow: hidden; }
.workspace-section { flex: 0 0 auto; padding: 16px 12px 12px; border-bottom: 1px solid var(--glass-border); }
.section-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; color: var(--text-secondary); font-size: 12px; font-weight: 700; }
.section-head button { display: inline-flex; align-items: center; gap: 5px; border: 0; color: var(--text-secondary); background: transparent; cursor: pointer; }
.section-head button:hover { color: var(--accent); }
.workspace-heading { display: flex; align-items: center; gap: 9px; width: 100%; padding: 9px 8px; border: 1px solid var(--glass-border); border-radius: var(--radius-sm); color: var(--text-primary); background: var(--surface-bg); text-align: left; cursor: pointer; }
.workspace-heading:hover { border-color: var(--accent); background: var(--hover-bg); }
.workspace-heading-copy { display: flex; min-width: 0; flex: 1; flex-direction: column; gap: 3px; }
.workspace-heading-copy strong, .workspace-heading-copy small { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.workspace-heading-copy strong { font-size: 13px; font-weight: 600; }
.workspace-heading-copy small { color: var(--text-faint); font-size: 10px; }
.workspace-heading-action { flex: 0 0 auto; color: var(--text-faint); }
.workspace-list { display: flex; flex-direction: column; gap: 2px; max-height: 116px; margin-top: 8px; overflow: auto; overscroll-behavior: contain; }
.workspace-row, .workspace-empty { width: 100%; display: flex; align-items: center; gap: 8px; padding: 7px 8px; border: 0; border-radius: var(--radius-sm); color: var(--text-secondary); background: transparent; text-align: left; cursor: pointer; font-size: 12px; transition: color 160ms ease, background-color 160ms ease, transform 160ms ease; }
.workspace-row span { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.workspace-row:hover, .workspace-empty:hover { color: var(--text-primary); background: var(--hover-bg); transform: translateX(2px); }
.workspace-row:active, .workspace-empty:active { transform: scale(0.98); }
.workspace-row.active { color: var(--text-primary); background: var(--selected-bg); }
.conversation-section { display: flex; flex: 1; min-height: 0; flex-direction: column; padding: 14px 8px 8px; }
.conversation-heading { padding: 0 5px 8px; margin-bottom: 0; }
.conversation-count { color: var(--text-faint); font-size: 11px; font-weight: 500; }
.conversation-list { min-width: 0; min-height: 0; flex: 1 1 auto; overflow-y: auto; overscroll-behavior: contain; }
.project-group { margin-bottom: 5px; }
.project-head { position: relative; display: flex; align-items: center; min-width: 0; border-radius: var(--radius-sm); color: var(--text-secondary); }
.project-head:hover { color: var(--text-primary); background: var(--hover-bg); }
.project-head.active { color: var(--text-primary); background: var(--selected-bg); box-shadow: inset 3px 0 0 var(--accent); }
.project-toggle { display: grid; place-items: center; flex: 0 0 auto; width: 28px; height: 30px; padding: 0; border: 0; border-radius: var(--radius-sm); color: inherit; background: transparent; cursor: pointer; }
.project-toggle:hover { color: var(--accent); background: var(--hover-bg); }
.project-select { display: flex; min-width: 0; flex: 1; align-items: center; gap: 6px; padding: 7px 5px 7px 0; border: 0; color: inherit; background: transparent; cursor: pointer; text-align: left; }
.project-select span { min-width: 0; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 12px; font-weight: 650; }
.project-select small { color: var(--text-faint); font-size: 10px; }
.project-archive { display: grid; place-items: center; width: 27px; height: 27px; margin-right: 3px; border: 0; border-radius: 5px; color: var(--text-faint); background: transparent; cursor: pointer; opacity: 0; }
.project-head:hover .project-archive, .project-head:focus-within .project-archive { opacity: 1; }
.project-archive:hover { color: var(--accent); background: var(--hover-bg); }
.project-conversations { padding-left: 22px; }
.empty-group { margin: 2px 8px 6px 8px; color: var(--text-faint); font-size: 11px; }
.ungrouped-group { border-top: 1px solid var(--glass-border); margin-top: 8px; padding-top: 7px; }
.conversation-row { position: relative; display: flex; align-items: center; gap: 8px; width: 100%; padding: 6px 8px; border: 0; border-radius: var(--radius-sm); color: var(--text-secondary); background: transparent; cursor: pointer; text-align: left; font-size: 13px; transition: color 160ms ease, background-color 160ms ease, transform 160ms ease; }
.conversation-row:hover { background: var(--hover-bg); color: var(--text-primary); transform: translateX(2px); }
.conversation-row.active { color: var(--text-primary); background: var(--selected-bg); }
.conversation-icon { flex: 0 0 auto; color: var(--text-faint); }
.conversation-copy { display: flex; min-width: 0; flex: 1; }
.conversation-copy strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 12px; font-weight: 500; }
.conversation-actions { display: flex; flex: 0 0 auto; align-items: center; gap: 3px; color: var(--text-faint); }
.conversation-time { font-size: 10px; }
.delete-action { display: grid; place-items: center; width: 24px; height: 24px; border-radius: 5px; opacity: 0; }
.conversation-row:hover .delete-action, .conversation-row:focus-visible .delete-action { opacity: 1; }
.delete-action:hover { color: var(--danger, #d9534f); background: var(--selected-bg); }
.sidebar-footer { flex: 0 0 auto; padding: 10px 12px 14px; border-top: 1px solid var(--glass-border); background: var(--panel-bg); }
.new-task { display: flex; align-items: center; justify-content: center; gap: 8px; width: 100%; padding: 9px 12px; border: 1px solid var(--accent); border-radius: var(--radius-sm); color: var(--accent-contrast, #fff); background: var(--accent); cursor: pointer; font-size: 13px; font-weight: 600; }
.new-task:hover { filter: brightness(0.96); }
</style>
