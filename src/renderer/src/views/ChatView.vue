<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import type { ComposerAttachment, ComposerMode } from '@/types'
import { useRouter } from 'vue-router'
import { Icon } from '@iconify/vue'
import EmptyState from '@/components/EmptyState.vue'
import SkeletonCard from '@/components/SkeletonCard.vue'
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
const LAYOUT_KEY = 'super-agent-pane-layout'
const leftWidth = ref(260)
const rightWidth = ref(320)
try {
  const saved = JSON.parse(localStorage.getItem(LAYOUT_KEY) || '')
  if (Number.isFinite(saved?.left)) leftWidth.value = saved.left
  if (Number.isFinite(saved?.right)) rightWidth.value = saved.right
} catch {}

function saveLayout() {
  localStorage.setItem(LAYOUT_KEY, JSON.stringify({ left: leftWidth.value, right: rightWidth.value }))
}

function startResize(side: 'left' | 'right', event: MouseEvent) {
  event.preventDefault()
  const startX = event.clientX
  const start = side === 'left' ? leftWidth.value : rightWidth.value
  const previousCursor = document.body.style.cursor
  const previousSelect = document.body.style.userSelect
  document.body.style.cursor = 'col-resize'
  document.body.style.userSelect = 'none'
  function move(ev: MouseEvent) {
    if (side === 'left') leftWidth.value = Math.min(480, Math.max(200, start + (ev.clientX - startX)))
    else rightWidth.value = Math.min(560, Math.max(260, start - (ev.clientX - startX)))
  }
  function up() {
    document.body.style.cursor = previousCursor
    document.body.style.userSelect = previousSelect
    window.removeEventListener('mousemove', move)
    window.removeEventListener('mouseup', up)
    saveLayout()
  }
  window.addEventListener('mousemove', move)
  window.addEventListener('mouseup', up)
}
const editingMessageId = ref<string | null>(null)
const editingText = ref('')
const attachments = ref<ComposerAttachment[]>([])
const composerMode = ref<ComposerMode>('coding')

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

async function send(payload?: { attachments: ComposerAttachment[]; mode: ComposerMode }) {
  const text = input.value.trim()
  if (!text || chat.running) return
  input.value = ''
  await chat.sendPrompt(text, { attachments: payload?.attachments || attachments.value, mode: payload?.mode || composerMode.value })
  attachments.value = []
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
  <main
    class="workbench"
    :class="{ 'workbench--right-closed': !rightOpen }"
    :style="{ '--left-pane-width': leftWidth + 'px', '--right-pane-width': rightWidth + 'px' }"
  >
    <aside class="left-pane">
      <header class="app-mark">
        <div class="logo">S</div>
        <span>Super-Agent</span>
      </header>

      <WorkspaceSidebar />
      <div class="pane-resizer" title="拖动调整侧栏宽度" @mousedown="startResize('left', $event)" />
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
                <div v-if="message.attachments?.length" class="message-attachments"><span v-for="attachment in message.attachments" :key="attachment.id" class="message-attachment"><Icon :icon="attachment.kind === 'image' ? 'mdi:image-outline' : 'mdi:file-outline'" width="14" />{{ attachment.name }}</span></div>
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
        <SkeletonCard v-else-if="!chat.hydrated" :rows="5" avatar />
        <EmptyState
          v-else
          title="从一个任务开始"
          desc="在左侧选择本地工作区，再让 Agent 阅读、修改和验证你的代码。"
        />
      </div>

      <footer class="composer-wrap">
        <ChatComposer v-model="input" :attachments="attachments" :running="chat.running" :workspace-name="chat.workspace ? activeWorkspaceName : '普通对话'" :model="settings.settings.model" :has-github="settings.hasGithubToken" @update:attachments="attachments = $event" @submit="send" @stop="chat.stop" />
      </footer>
    </section>

    <div v-if="rightOpen" class="right-shell">
      <div class="pane-resizer pane-resizer--left" title="拖动调整详情栏宽度" @mousedown="startResize('right', $event)" />
      <RightPanel />
    </div>
  </main>
</template>

<style scoped>
.workbench { display: grid; grid-template-columns: var(--left-pane-width) minmax(0, 1fr) var(--right-pane-width); width: 100%; height: 100vh; min-height: 0; overflow: hidden; background: var(--workbench-bg); }
.workbench--right-closed { grid-template-columns: var(--left-pane-width) minmax(0, 1fr); }
.left-pane { position: relative; display: flex; flex-direction: column; min-width: 0; min-height: 0; overflow: hidden; background: var(--panel-bg); border-right: 1px solid var(--glass-border); }
.app-mark { height: var(--topbar-height); display: flex; align-items: center; gap: 8px; padding: 0 10px; border-bottom: 1px solid var(--glass-border); color: var(--text-primary); background: var(--panel-bg); font-size: 13px; font-weight: 600; }
.logo { width: 18px; height: 18px; display: grid; place-items: center; border-radius: 3px; color: white; background: var(--accent); font-size: 11px; }
.center-pane { display: flex; min-width: 0; min-height: 0; flex-direction: column; overflow: hidden; background: var(--workbench-bg); }
.topbar { height: var(--topbar-height); flex: 0 0 var(--topbar-height); display: flex; align-items: center; justify-content: space-between; padding: 0 12px; border-bottom: 1px solid var(--glass-border); background: var(--panel-bg); }
.topbar-context { display: flex; align-items: center; gap: 10px; min-width: 0; }
.topbar-context strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 13px; font-weight: 600; }
.topbar-context span { display: inline-flex; align-items: center; gap: 5px; overflow: hidden; color: var(--text-secondary); text-overflow: ellipsis; white-space: nowrap; font-size: 12px; }
.topbar-actions { display: flex; gap: 2px; }
.topbar-actions button { display: grid; place-items: center; width: 26px; height: 26px; border: 0; border-radius: 3px; color: var(--text-secondary); background: transparent; cursor: pointer; }
.topbar-actions button:hover { color: var(--text-primary); background: var(--hover-bg); }
.message-scroll { flex: 1 1 auto; min-width: 0; min-height: 0; overflow: auto; overscroll-behavior: contain; }
.message-list { width: min(900px, 100%); min-width: 0; margin: 0 auto; padding: calc(16px * var(--ui-space-scale)) calc(20px * var(--ui-space-scale)) calc(24px * var(--ui-space-scale)); }
.message { display: flex; min-width: 0; margin-bottom: var(--space-4); }
.message--user { justify-content: flex-start; }
.user-message-wrap { max-width: min(820px, 100%); }
.user-message { display: flex; align-items: flex-start; gap: 8px; padding: 6px 0; color: var(--text-primary); white-space: pre-wrap; line-height: 1.55; flex-wrap: wrap; }.message-attachments { display:flex; width:100%; gap:5px; flex-wrap:wrap; }.message-attachment { display:inline-flex; align-items:center; gap:4px; padding:2px 6px; border:1px solid var(--glass-border); border-radius:3px; color:var(--text-secondary); background:var(--panel-bg); font-size:11px; }
.edit-message { flex: 0 0 auto; display: grid; place-items: center; width: 22px; height: 22px; margin: 0; border: 0; border-radius: 3px; color: var(--text-secondary); background: transparent; cursor: pointer; opacity: 0; }
.user-message:hover .edit-message { opacity: 1; }
.edit-message:hover { color: var(--text-primary); background: var(--hover-bg); }
.message-editor { width: min(820px, 100%); padding: 6px; border: 1px solid var(--accent); border-radius: 3px; background: var(--surface-bg); }
.message-editor :deep(.el-textarea__inner) { border: 0; box-shadow: none; background: transparent; }
.editor-actions { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 6px 4px 0; color: var(--text-secondary); font-size: 11px; }
.editor-actions > div { display: flex; gap: 4px; }
.assistant-message { width: min(820px, 100%); min-width: 0; color: var(--text-primary); line-height: 1.6; }
.assistant-message :deep(.tool-code),
.assistant-message :deep(.orphan-result),
.assistant-message :deep(.diff-body) { max-width: 100%; overflow: auto; overscroll-behavior: contain; }
.waiting { display: inline-flex; align-items: center; gap: 7px; color: var(--text-secondary); font-size: 13px; }
.composer-wrap { flex: 0 0 auto; padding: calc(8px * var(--ui-space-scale)) calc(16px * var(--ui-space-scale)) calc(10px * var(--ui-space-scale)); border-top: 1px solid var(--glass-border); background: var(--workbench-bg); }
.right-shell { position: relative; min-width: 0; min-height: 0; overflow: hidden; }
.pane-resizer { position: absolute; top: 0; right: 0; z-index: 8; width: 6px; height: 100%; cursor: col-resize; }
.pane-resizer--left { right: auto; left: 0; }
.pane-resizer:hover, .pane-resizer:active { background: var(--accent); opacity: 0.45; }
@media (max-width: 1280px) { .workbench { grid-template-columns: var(--left-pane-width) minmax(0, 1fr); } .right-shell { display: none; } }
@media (max-width: 860px) { .workbench { grid-template-columns: var(--left-pane-width) minmax(0, 1fr); } .topbar-context span { display: none; } }
</style>
