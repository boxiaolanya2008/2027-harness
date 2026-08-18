<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { Icon } from '@iconify/vue'
import EmptyState from '@/components/EmptyState.vue'
import MarkdownView from '@/components/MarkdownView.vue'
import TurnTimeline from '@/components/TurnTimeline.vue'
import RightPanel from '@/components/RightPanel.vue'
import WorkspaceSidebar from '@/components/WorkspaceSidebar.vue'
import { useChatStore } from '@/stores/chat'

const router = useRouter()
const chat = useChatStore()
const input = ref('')
const listRef = ref<HTMLElement | null>(null)
const rightOpen = ref(true)

const activeConversation = computed(() => chat.current())
const activeWorkspaceName = computed(() => chat.workspace?.split(/[\\/]/).filter(Boolean).pop() || '未选择工作区')

function nearBottom() {
  const element = listRef.value
  return !!element && element.scrollHeight - element.scrollTop - element.clientHeight < 100
}

function scrollDown(force = false) {
  if (!force && !nearBottom()) return
  nextTick(() => listRef.value?.scrollTo({ top: listRef.value!.scrollHeight, behavior: 'smooth' }))
}

async function send() {
  const text = input.value.trim()
  if (!text || chat.running) return
  input.value = ''
  await chat.sendPrompt(text)
  scrollDown(true)
}

watch(
  () => activeConversation.value?.messages.map((message) => `${message.id}:${message.content.length}:${message.events?.length || 0}`).join('|'),
  () => scrollDown(),
  { flush: 'post' }
)
</script>

<template>
  <main class="workbench" :class="{ 'workbench--right-closed': !rightOpen }">
    <aside class="left-pane">
      <header class="app-mark">
        <div class="logo">S</div>
        <span>Super-Agent</span>
      </header>

      <nav class="primary-nav">
        <button class="nav-item active" @click="chat.newConversation()"><Icon icon="mdi:plus" width="18" /> 新建任务</button>
        <button class="nav-item" @click="router.push('/settings')"><Icon icon="mdi:cog" width="18" /> 设置</button>
      </nav>

      <WorkspaceSidebar />

      <section class="conversation-section">
        <div class="section-head">
          <span>会话</span>
          <button title="新建会话" @click="chat.newConversation()"><Icon icon="mdi:plus" width="16" /></button>
        </div>
        <div class="conversation-list">
          <button
            v-for="conversation in chat.conversations"
            :key="conversation.id"
            class="conversation-row"
            :class="{ active: conversation.id === chat.currentId }"
            @click="chat.select(conversation.id)"
          >
            <Icon icon="mdi:message-text-outline" width="15" />
            <span>{{ conversation.title }}</span>
            <Icon class="delete" icon="mdi:delete-outline" width="14" @click.stop="chat.remove(conversation.id)" />
          </button>
          <EmptyState v-if="!chat.conversations.length && chat.hydrated" title="还没有会话" desc="新建任务后，会话会保存在本机。" />
        </div>
      </section>
    </aside>

    <section class="center-pane">
      <header class="topbar">
        <div class="topbar-context">
          <strong>{{ activeConversation?.title || '新任务' }}</strong>
          <span><Icon icon="mdi:folder-open-outline" width="14" /> {{ activeWorkspaceName }}</span>
        </div>
        <div class="topbar-actions">
          <button title="切换详情栏" @click="rightOpen = !rightOpen"><Icon icon="mdi:page-layout-sidebar-right" width="18" /></button>
          <button title="应用设置" @click="router.push('/settings')"><Icon icon="mdi:cog" width="18" /></button>
        </div>
      </header>

      <div ref="listRef" class="message-scroll">
        <div v-if="activeConversation" class="message-list">
          <article v-for="message in activeConversation.messages" :key="message.id" class="message" :class="`message--${message.role}`">
            <div v-if="message.role === 'user'" class="user-message">{{ message.content }}</div>
            <div v-else class="assistant-message">
              <TurnTimeline v-if="message.events?.length" :events="message.events" :streaming="chat.running" />
              <MarkdownView v-else-if="message.content" :content="message.content" />
              <span v-else class="waiting"><Icon icon="mdi:loading" width="18" /> 正在准备</span>
            </div>
          </article>
        </div>
        <EmptyState
          v-else
          title="从一个任务开始"
          desc="在左侧选择本地工作区，再让 Agent 阅读、修改和验证你的代码。"
        />
      </div>

      <footer class="composer-wrap">
        <div class="composer">
          <el-input
            v-model="input"
            type="textarea"
            :autosize="{ minRows: 2, maxRows: 8 }"
            resize="none"
            placeholder="描述要完成的工作，或问代码库和 GitHub…"
            @keydown.enter.exact.prevent="send"
          />
          <div class="composer-foot">
            <span>{{ chat.workspace ? `工作区：${activeWorkspaceName}` : '未选工作区：可进行普通模型对话' }}</span>
            <div>
              <el-button v-if="chat.running" type="danger" text @click="chat.stop()">停止</el-button>
              <el-button type="primary" :disabled="!input.trim() || chat.running" @click="send">发送</el-button>
            </div>
          </div>
        </div>
      </footer>
    </section>

    <RightPanel v-if="rightOpen" class="right-pane" />
  </main>
</template>

<style scoped>
.workbench { display: grid; grid-template-columns: var(--left-pane-width) minmax(0, 1fr) var(--right-pane-width); width: 100%; height: 100%; overflow: hidden; background: var(--workbench-bg); }
.workbench--right-closed { grid-template-columns: var(--left-pane-width) minmax(0, 1fr); }
.left-pane { display: flex; flex-direction: column; min-width: 0; min-height: 0; background: var(--panel-bg); border-right: 1px solid var(--glass-border); }
.app-mark { height: var(--topbar-height); display: flex; align-items: center; gap: 9px; padding: 0 14px; border-bottom: 1px solid var(--glass-border); color: var(--text-primary); font-size: 14px; font-weight: 700; }
.logo { width: 24px; height: 24px; display: grid; place-items: center; border-radius: 6px; color: white; background: var(--accent); font-size: 13px; }
.primary-nav { display: flex; flex-direction: column; gap: 2px; padding: 10px 8px; border-bottom: 1px solid var(--glass-border); }
.nav-item, .section-head button { display: flex; align-items: center; gap: 9px; width: 100%; padding: 8px 9px; border: 0; border-radius: var(--radius-sm); color: var(--text-secondary); background: transparent; text-align: left; cursor: pointer; font-size: 13px; }
.nav-item:hover { color: var(--text-primary); background: var(--hover-bg); }
.nav-item.active { color: var(--text-primary); background: var(--selected-bg); }
.conversation-section { display: flex; flex: 1; min-height: 0; flex-direction: column; padding: 12px 8px; }
.section-head { display: flex; align-items: center; justify-content: space-between; padding: 0 5px 7px; color: var(--text-secondary); font-size: 12px; font-weight: 700; }
.section-head button { width: auto; padding: 2px; }
.conversation-list { min-height: 0; overflow: auto; }
.conversation-row { display: flex; align-items: center; gap: 8px; width: 100%; padding: 8px; border: 0; border-radius: var(--radius-sm); color: var(--text-secondary); background: transparent; cursor: pointer; text-align: left; font-size: 13px; }
.conversation-row:hover { background: var(--hover-bg); color: var(--text-primary); }
.conversation-row.active { color: var(--text-primary); background: var(--selected-bg); }
.conversation-row span { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.delete { visibility: hidden; color: var(--text-faint); }
.conversation-row:hover .delete { visibility: visible; }
.center-pane { display: flex; min-width: 0; min-height: 0; flex-direction: column; background: var(--workbench-bg); }
.topbar { height: var(--topbar-height); flex: 0 0 var(--topbar-height); display: flex; align-items: center; justify-content: space-between; padding: 0 18px; border-bottom: 1px solid var(--glass-border); }
.topbar-context { display: flex; align-items: center; gap: 14px; min-width: 0; }
.topbar-context strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 14px; }
.topbar-context span { display: inline-flex; align-items: center; gap: 5px; overflow: hidden; color: var(--text-secondary); text-overflow: ellipsis; white-space: nowrap; font-size: 12px; }
.topbar-actions { display: flex; gap: 4px; }
.topbar-actions button { display: grid; place-items: center; width: 30px; height: 30px; border: 0; border-radius: var(--radius-sm); color: var(--text-secondary); background: transparent; cursor: pointer; }
.topbar-actions button:hover { color: var(--text-primary); background: var(--hover-bg); }
.message-scroll { flex: 1; min-width: 0; min-height: 0; overflow: auto; }
.message-list { width: min(900px, 100%); margin: 0 auto; padding: 28px clamp(18px, 4vw, 48px) 42px; }
.message { display: flex; margin-bottom: 24px; }
.message--user { justify-content: flex-end; }
.user-message { max-width: min(720px, 86%); padding: 11px 13px; border-radius: 10px; color: var(--text-primary); background: var(--selected-bg); white-space: pre-wrap; line-height: 1.6; }
.assistant-message { width: min(820px, 100%); min-width: 0; color: var(--text-primary); line-height: 1.7; }
.waiting { display: inline-flex; align-items: center; gap: 7px; color: var(--text-secondary); font-size: 13px; }
.composer-wrap { flex: 0 0 auto; padding: 14px clamp(18px, 4vw, 48px) 20px; border-top: 1px solid var(--glass-border); background: var(--workbench-bg); }
.composer { width: min(900px, 100%); margin: 0 auto; overflow: hidden; border: 1px solid var(--glass-border); border-radius: 10px; background: var(--surface-bg); box-shadow: 0 4px 14px rgba(20, 24, 32, 0.05); }
.composer:focus-within { border-color: var(--accent); box-shadow: 0 0 0 3px var(--focus-ring); }
.composer :deep(.el-textarea__inner) { min-height: 52px !important; padding: 13px 14px 8px; border: 0; box-shadow: none; color: var(--text-primary); background: transparent; line-height: 1.6; }
.composer-foot { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 7px 8px 8px 14px; color: var(--text-faint); font-size: 11px; }
.right-pane { min-width: 0; min-height: 0; }
@media (max-width: 1280px) { .workbench { grid-template-columns: 244px minmax(0, 1fr); } .right-pane { display: none; } }
@media (max-width: 860px) { .workbench { grid-template-columns: 208px minmax(0, 1fr); } .topbar-context span { display: none; } }
</style>
