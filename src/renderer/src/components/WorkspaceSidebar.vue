<script setup lang="ts">
import { computed } from 'vue'
import { Icon } from '@iconify/vue'
import EmptyState from '@/components/EmptyState.vue'
import { useChatStore } from '@/stores/chat'

const chat = useChatStore()
const workspaceName = computed(() => chat.workspace?.split(/[\\/]/).filter(Boolean).pop() || '选择工作区')
const recentConversations = computed(() => [...chat.conversations].sort((left, right) => {
  const leftTime = left.updatedAt || left.createdAt
  const rightTime = right.updatedAt || right.createdAt
  return rightTime - leftTime
}))

async function pickWorkspace() {
  const path = await window.api.dialog.pickDir()
  if (!path) return
  await chat.selectWorkspace(path)
}

function formatConversationTime(conversation: { updatedAt?: number; createdAt: number }) {
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
        <span class="workspace-heading-copy">
          <strong>{{ workspaceName }}</strong>
          <small>{{ chat.workspace || '选择本地目录开始任务' }}</small>
        </span>
        <Icon class="workspace-heading-action" icon="mdi:chevron-right" width="16" />
      </button>

      <div class="workspace-list" aria-label="最近工作区">
        <button
          v-for="path in chat.workspaces"
          :key="path"
          class="workspace-row"
          :class="{ active: path === chat.workspace }"
          :title="path"
          @click="chat.selectWorkspace(path)"
        >
          <Icon icon="mdi:folder-open-outline" width="16" />
          <span>{{ path.split(/[\\/]/).filter(Boolean).pop() }}</span>
        </button>
        <button v-if="!chat.workspaces.length" class="workspace-empty" @click="pickWorkspace">
          <Icon icon="mdi:folder-plus-outline" width="16" /> 选择本地目录
        </button>
      </div>
    </div>

    <section class="conversation-section">
      <div class="section-head conversation-heading">
        <span>最近任务</span>
        <span class="conversation-count">{{ recentConversations.length }}</span>
      </div>
      <div class="conversation-list">
        <button
          v-for="conversation in recentConversations"
          :key="conversation.id"
          class="conversation-row"
          :class="{ active: conversation.id === chat.currentId }"
          @click="chat.select(conversation.id)"
        >
          <Icon class="conversation-icon" icon="mdi:message-text-outline" width="16" />
          <span class="conversation-copy">
            <strong>{{ conversation.title }}</strong>
            <small>{{ formatConversationTime(conversation) }}</small>
          </span>
          <span class="conversation-actions">
            <span class="conversation-time">{{ formatConversationTime(conversation) }}</span>
            <span class="delete-action" title="删除任务" @click.stop="chat.remove(conversation.id)">
              <Icon icon="mdi:delete-outline" width="15" />
            </span>
          </span>
        </button>
        <EmptyState v-if="!recentConversations.length && chat.hydrated" title="还没有任务" desc="新建任务后，会话会保存在本机。" />
      </div>
    </section>

    <div class="sidebar-footer">
      <button class="new-task" @click="chat.newConversation()">
        <Icon icon="mdi:plus" width="18" />
        <span>新建任务</span>
      </button>
    </div>
  </section>
</template>

<style scoped>
.workspace-sidebar { display: flex; flex: 1; min-height: 0; flex-direction: column; overflow: hidden; }
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
.workspace-list { display: flex; flex-direction: column; gap: 2px; max-height: 116px; margin-top: 8px; overflow: auto; }
.workspace-row, .workspace-empty { width: 100%; display: flex; align-items: center; gap: 8px; padding: 7px 8px; border: 0; border-radius: var(--radius-sm); color: var(--text-secondary); background: transparent; text-align: left; cursor: pointer; font-size: 12px; }
.workspace-row span { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.workspace-row:hover, .workspace-empty:hover { color: var(--text-primary); background: var(--hover-bg); }
.workspace-row.active { color: var(--text-primary); background: var(--selected-bg); }
.conversation-section { display: flex; flex: 1; min-height: 0; flex-direction: column; padding: 14px 8px 8px; }
.conversation-heading { padding: 0 5px 8px; margin-bottom: 0; }
.conversation-count { color: var(--text-faint); font-size: 11px; font-weight: 500; }
.conversation-list { min-height: 0; flex: 1; overflow-y: auto; }
.conversation-row { position: relative; display: flex; align-items: center; gap: 8px; width: 100%; padding: 9px 8px; border: 0; border-radius: var(--radius-sm); color: var(--text-secondary); background: transparent; cursor: pointer; text-align: left; font-size: 13px; }
.conversation-row:hover { background: var(--hover-bg); color: var(--text-primary); }
.conversation-row.active { color: var(--text-primary); background: var(--selected-bg); }
.conversation-icon { flex: 0 0 auto; color: var(--text-faint); }
.conversation-copy { display: flex; min-width: 0; flex: 1; flex-direction: column; gap: 3px; }
.conversation-copy strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 12px; font-weight: 500; }
.conversation-copy small { color: var(--text-faint); font-size: 10px; }
.conversation-actions { display: flex; flex: 0 0 auto; align-items: center; gap: 3px; color: var(--text-faint); }
.conversation-time { font-size: 10px; }
.delete-action { display: grid; place-items: center; width: 24px; height: 24px; border-radius: 5px; opacity: 0; }
.conversation-row:hover .delete-action, .conversation-row:focus-visible .delete-action { opacity: 1; }
.delete-action:hover { color: var(--danger, #d9534f); background: var(--selected-bg); }
.sidebar-footer { flex: 0 0 auto; padding: 10px 12px 14px; border-top: 1px solid var(--glass-border); background: var(--panel-bg); }
.new-task { display: flex; align-items: center; justify-content: center; gap: 8px; width: 100%; padding: 9px 12px; border: 1px solid var(--accent); border-radius: var(--radius-sm); color: var(--accent-contrast, #fff); background: var(--accent); cursor: pointer; font-size: 13px; font-weight: 600; }
.new-task:hover { filter: brightness(0.96); }
</style>
