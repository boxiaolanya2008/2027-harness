<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { Icon } from '@iconify/vue'
import EmptyState from '@/components/EmptyState.vue'
import MarkdownView from '@/components/MarkdownView.vue'
import TurnTimeline from '@/components/TurnTimeline.vue'
import RightPanel from '@/components/RightPanel.vue'
import WorkspaceSidebar from '@/components/WorkspaceSidebar.vue'
import ChatComposer from '@/components/ChatComposer.vue'
import { useChatStore } from '@/stores/chat'
import { useSettingsStore } from '@/stores/settings'

const router = useRouter()
const chat = useChatStore()
const settings = useSettingsStore()
const input = ref('')
const listRef = ref<HTMLElement | null>(null)
const rightOpen = ref(true)
const editingMessageId = ref<string | null>(null)
const editingText = ref('')

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

function startEdit(messageId: string, content: string) {
  if (chat.running) return
  editingMessageId.value = messageId
  editingText.value = content
}

function cancelEdit() {
  editingMessageId.value = null
  editingText.value = ''
}

async function confirmEdit() {
  if (!editingMessageId.value || !editingText.value.trim() || chat.running) return
  const id = editingMessageId.value
  const text = editingText.value
  cancelEdit()
  await chat.editAndRegenerate(id, text)
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
        <button class="app-settings" title="应用设置" @click="router.push('/settings')"><Icon icon="mdi:cog" width="17" /></button>
      </header>

      <WorkspaceSidebar />
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
            <div v-if="message.role === 'user'" class="user-message-wrap">
              <div v-if="editingMessageId !== message.id" class="user-message" @dblclick="startEdit(message.id, message.content)">
                <span>{{ message.content }}</span>
                <button v-if="!chat.running" class="edit-message" title="编辑消息" @click="startEdit(message.id, message.content)">
                  <Icon icon="mdi:pencil-outline" width="14" />
                </button>
              </div>
              <div v-else class="message-editor">
                <el-input v-model="editingText" type="textarea" :autosize="{ minRows: 2, maxRows: 8 }" @keydown.esc="cancelEdit" @keydown.meta.enter.prevent="confirmEdit" @keydown.ctrl.enter.prevent="confirmEdit" />
                <div class="editor-actions">
                  <span>Ctrl/Cmd + Enter 重新生成 · Esc 取消</span>
                  <div><el-button text @click="cancelEdit">取消</el-button><el-button type="primary" :disabled="!editingText.trim()" @click="confirmEdit">重新生成</el-button></div>
                </div>
              </div>
            </div>
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
        <ChatComposer v-model="input" :running="chat.running" :workspace-name="chat.workspace ? activeWorkspaceName : '普通对话'" :model="settings.settings.model" :has-github="settings.hasGithubToken" @submit="send" @stop="chat.stop" />
      </footer>
    </section>

    <RightPanel v-if="rightOpen" class="right-pane" />
  </main>
</template>

<style scoped>
.workbench { display: grid; grid-template-columns: var(--left-pane-width) minmax(0, 1fr) var(--right-pane-width); width: 100%; height: 100vh; min-height: 0; overflow: hidden; background: var(--workbench-bg); }
.workbench--right-closed { grid-template-columns: var(--left-pane-width) minmax(0, 1fr); }
.left-pane { display: flex; flex-direction: column; min-width: 0; min-height: 0; overflow: hidden; background: var(--panel-bg); border-right: 1px solid var(--glass-border); }
.app-mark { height: var(--topbar-height); display: flex; align-items: center; gap: 9px; padding: 0 14px; border-bottom: 1px solid var(--glass-border); color: var(--text-primary); font-size: 14px; font-weight: 700; }
.logo { width: 24px; height: 24px; display: grid; place-items: center; border-radius: 6px; color: white; background: var(--accent); font-size: 13px; }
.app-settings { display: grid; place-items: center; width: 28px; height: 28px; margin-left: auto; padding: 0; border: 0; border-radius: var(--radius-sm); color: var(--text-secondary); background: transparent; cursor: pointer; }
.app-settings:hover { color: var(--text-primary); background: var(--hover-bg); }
.app-settings, .topbar-actions button, .edit-message { transition: color 160ms ease, background-color 160ms ease, opacity 160ms ease, transform 160ms ease; }
.app-settings:active, .topbar-actions button:active, .edit-message:active { transform: scale(0.94); }
.center-pane { display: flex; min-width: 0; min-height: 0; flex-direction: column; overflow: hidden; background: var(--workbench-bg); }
.topbar { height: var(--topbar-height); flex: 0 0 var(--topbar-height); display: flex; align-items: center; justify-content: space-between; padding: 0 18px; border-bottom: 1px solid var(--glass-border); }
.topbar-context { display: flex; align-items: center; gap: 14px; min-width: 0; }
.topbar-context strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 14px; }
.topbar-context span { display: inline-flex; align-items: center; gap: 5px; overflow: hidden; color: var(--text-secondary); text-overflow: ellipsis; white-space: nowrap; font-size: 12px; }
.topbar-actions { display: flex; gap: 4px; }
.topbar-actions button { display: grid; place-items: center; width: 30px; height: 30px; border: 0; border-radius: var(--radius-sm); color: var(--text-secondary); background: transparent; cursor: pointer; }
.topbar-actions button:hover { color: var(--text-primary); background: var(--hover-bg); }
.message-scroll { flex: 1 1 auto; min-width: 0; min-height: 0; overflow: auto; overscroll-behavior: contain; }
.message-list { width: min(900px, 100%); min-width: 0; margin: 0 auto; padding: 28px clamp(18px, 4vw, 48px) 42px; }
.message { display: flex; min-width: 0; margin-bottom: 24px; animation: message-enter 200ms ease-out both; }
.message--user { justify-content: flex-end; }
.user-message-wrap { max-width: min(720px, 86%); }
.user-message { display: flex; align-items: flex-start; gap: 10px; padding: 11px 13px; border-radius: 10px; color: var(--text-primary); background: var(--selected-bg); white-space: pre-wrap; line-height: 1.6; }
.edit-message { flex: 0 0 auto; display: grid; place-items: center; width: 24px; height: 24px; margin: -3px -5px 0 0; border: 0; border-radius: 5px; color: var(--text-secondary); background: transparent; cursor: pointer; opacity: 0; }
.user-message:hover .edit-message { opacity: 1; }
.edit-message:hover { color: var(--accent); background: var(--hover-bg); }
.message-editor { width: min(720px, 86vw); padding: 8px; border: 1px solid var(--accent); border-radius: 10px; background: var(--surface-bg); box-shadow: 0 0 0 3px var(--focus-ring); }
.message-editor :deep(.el-textarea__inner) { border: 0; box-shadow: none; background: transparent; }
.editor-actions { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 6px 4px 0; color: var(--text-faint); font-size: 11px; }
.editor-actions > div { display: flex; gap: 4px; }
.assistant-message { width: min(820px, 100%); min-width: 0; color: var(--text-primary); line-height: 1.7; }
.assistant-message :deep(.tool-card),
.assistant-message :deep(.orphan-result),
.assistant-message :deep(.diff-view) { animation: tool-area-enter 200ms ease-out both; }
.assistant-message :deep(.tool-code),
.assistant-message :deep(.orphan-result),
.assistant-message :deep(.diff-body) { max-width: 100%; overflow: auto; overscroll-behavior: contain; }
.waiting { display: inline-flex; align-items: center; gap: 7px; color: var(--text-secondary); font-size: 13px; }
.composer-wrap { flex: 0 0 auto; padding: 14px clamp(18px, 4vw, 48px) 20px; border-top: 1px solid var(--glass-border); background: var(--workbench-bg); }
.composer { width: min(900px, 100%); margin: 0 auto; overflow: hidden; border: 1px solid var(--glass-border); border-radius: 10px; background: var(--surface-bg); box-shadow: 0 4px 14px rgba(20, 24, 32, 0.05); }
.composer:focus-within { border-color: var(--accent); box-shadow: 0 0 0 3px var(--focus-ring); }
.composer :deep(.el-textarea__inner) { min-height: 52px !important; padding: 13px 14px 8px; border: 0; box-shadow: none; color: var(--text-primary); background: transparent; line-height: 1.6; }
.composer-foot { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 7px 8px 8px 14px; color: var(--text-faint); font-size: 11px; }
.right-pane { min-width: 0; min-height: 0; overflow: hidden; animation: side-panel-enter 220ms ease-out both; }
@keyframes message-enter {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes side-panel-enter {
  from { opacity: 0; transform: translateX(10px); }
  to { opacity: 1; transform: translateX(0); }
}
@keyframes tool-area-enter {
  from { opacity: 0; transform: translateY(6px); }
  to { opacity: 1; transform: translateY(0); }
}
@media (max-width: 1280px) { .workbench { grid-template-columns: 244px minmax(0, 1fr); } .right-pane { display: none; } }
@media (max-width: 860px) { .workbench { grid-template-columns: 208px minmax(0, 1fr); } .topbar-context span { display: none; } }
</style>
