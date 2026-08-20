<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import type { ComposerAddAction, ComposerAttachment, ComposerMode, ComposerPluginItem } from '@/types'
import { useRouter } from 'vue-router'
import { Icon } from '@iconify/vue'
import { ElMessage } from 'element-plus'
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
const rightOpen = ref(false)
const LAYOUT_KEY = 'super-agent-pane-layout'
const leftWidth = ref(200)
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
    if (side === 'left') leftWidth.value = Math.min(320, Math.max(160, start + (ev.clientX - startX)))
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
const composerAddActions = ref<ComposerAddAction[]>([])
const composerPlugins = ref<ComposerPluginItem[]>([])

const activeConversation = computed(() => chat.current())
const activeWorkspaceName = computed(() => chat.workspace?.split(/[\\/]/).filter(Boolean).pop() || '2027-harness')
const currentBranch = ref('main')
const activeMessageId = ref<string | null>(null)

const navigableMessages = computed(() => activeConversation.value?.messages || [])

function updateActiveMessage() {
  const container = listRef.value
  if (!container || !navigableMessages.value.length) {
    activeMessageId.value = null
    return
  }
  const threshold = container.scrollTop + 24
  const elements = Array.from(container.querySelectorAll<HTMLElement>('[data-message-id]'))
  let active = elements[0]
  for (const element of elements) {
    if (element.offsetTop <= threshold) active = element
    else break
  }
  activeMessageId.value = active?.dataset.messageId || navigableMessages.value[0]?.id || null
}

function scrollToMessage(id: string) {
  const container = listRef.value
  const target = container?.querySelector<HTMLElement>(`[data-message-id="${CSS.escape(id)}"]`)
  if (!container || !target) return
  activeMessageId.value = id
  container.scrollTo({ top: Math.max(0, target.offsetTop - 12), behavior: 'smooth' })
}

async function updateCurrentBranch() {
  if (!chat.workspace) {
    currentBranch.value = 'main'
    return
  }
  try {
    const branch = await window.api.git.branch(chat.workspace)
    currentBranch.value = branch || 'main'
  } catch {
    currentBranch.value = 'main'
  }
}

watch(() => chat.workspace, () => {
  void updateCurrentBranch()
}, { immediate: true })

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

function handleAddAction(key: string) {
  ElMessage.info(`添加动作：${key}`)
}

function handlePlugin(key: string) {
  ElMessage.info(`插件：${key}`)
}

function handleApprove() {
  ElMessage.info('已请求批准')
}

function handleRename() {
  const conv = activeConversation.value
  if (!conv) return
  const next = window.prompt('重命名当前聊天', conv.title)
  if (next && next.trim()) {
    conv.title = next.trim()
    void chat.persistUiState()
  }
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

function handleMessageScroll() {
  updateActiveMessage()
}

function handleSuggestion(text: string) {
  input.value = text
}

async function handlePickWorkspace() {
  const path = await window.api.dialog.pickDir()
  if (!path) return
  await chat.selectWorkspace(path)
  void updateCurrentBranch()
}
function handleBranchClick() {
  ElMessage.info(`当前分支: ${currentBranch.value}，可在终端执行 git checkout 切换`)
}

watch(
  () => activeConversation.value?.messages.map((message) => `${message.id}:${message.content.length}:${message.events?.length || 0}`).join('|'),
  () => {
    scrollDown()
    nextTick(updateActiveMessage)
  },
  { flush: 'post' }
)

watch(() => activeConversation.value?.id, () => {
  activeMessageId.value = navigableMessages.value[0]?.id || null
  nextTick(updateActiveMessage)
})

const isEmpty = computed(() => !activeConversation.value || !activeConversation.value.messages.length)
</script>

<template>
  <div class="codex-window">
    <!-- 顶部窗口栏（已按圈选删除右侧 Codex 版本与窗口控制，功能已下沉至底部信息栏） -->
    <div class="window-bar">
      <div class="window-bar-left">
        <span class="win-dot" />
        <span class="win-nav"><Icon icon="mdi:arrow-left" width="14" /> <Icon icon="mdi:arrow-right" width="14" /></span>
        <span class="win-menu">文件</span><span class="win-menu">编辑</span><span class="win-menu">视图</span><span class="win-menu">帮助</span>
      </div>
    </div>

    <main
      class="workbench"
      :class="{ 'workbench--right-closed': !rightOpen }"
      :style="{ '--left-pane-width': leftWidth + 'px', '--right-pane-width': rightWidth + 'px' }"
    >
      <aside class="left-pane">
        <WorkspaceSidebar />
        <div class="pane-resizer" title="拖动调整侧栏宽度" @mousedown="startResize('left', $event)" />
      </aside>

      <section class="center-pane">
        <div ref="listRef" class="message-scroll" @scroll="handleMessageScroll">
          <!-- 有消息时显示原有时间线 -->
          <template v-if="!isEmpty">
            <div class="message-list">
              <article v-for="message in activeConversation!.messages" :key="message.id" :data-message-id="message.id" class="message" :class="`message--${message.role}`">
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
          </template>

          <!-- 空状态：复刻图一 -->
          <template v-else-if="chat.hydrated">
            <div class="codex-empty">
              <div class="empty-icon"><Icon icon="mdi:cloud-outline" width="48" height="48" /></div>
              <h1 class="empty-title">你想让我们在 <span class="empty-highlight">{{ activeWorkspaceName }}</span> 中构建什么？</h1>
              <div class="suggestion-grid">
                <button class="suggestion-card" @click="handleSuggestion('探索并理解这个代码库的结构和主要功能')">
                  <Icon icon="mdi:compass-outline" width="20" class="s-icon s-blue" />
                  <span>探索并理解代码</span>
                </button>
                <button class="suggestion-card" @click="handleSuggestion('构建一个新功能、应用或工具')">
                  <Icon icon="mdi:hammer-wrench" width="20" class="s-icon s-purple" />
                  <span>构建新功能、应用或工具</span>
                </button>
                <button class="suggestion-card" @click="handleSuggestion('审查代码并提出修改建议')">
                  <Icon icon="mdi:refresh" width="20" class="s-icon s-green" />
                  <span>审查代码并提出修改建议</span>
                </button>
                <button class="suggestion-card" @click="handleSuggestion('修复一个问题或失败的测试')">
                  <Icon icon="mdi:bug-outline" width="20" class="s-icon s-orange" />
                  <span>修复问题和失败</span>
                </button>
              </div>
            </div>
          </template>

          <SkeletonCard v-else :rows="5" avatar />
        </div>

        <nav v-if="navigableMessages.length > 1" class="message-navigator" aria-label="消息位置导航">
          <button
            v-for="(message, index) in navigableMessages"
            :key="message.id"
            type="button"
            class="message-marker"
            :class="{ active: activeMessageId === message.id, 'message-marker--user': message.role === 'user' }"
            :aria-current="activeMessageId === message.id ? 'location' : undefined"
            :aria-label="`跳转到第 ${index + 1} 条${message.role === 'user' ? '用户' : '助手'}消息`"
            :title="`第 ${index + 1} 条消息`"
            @click="scrollToMessage(message.id)"
          />
        </nav>

        <!-- 底部输入区：顶部灰条与输入卡连体（可点击且真实联动） -->
        <div class="composer-area">
          <div class="composer-combined">
            <div class="composer-info-bar">
              <button class="info-item info-item--btn" @click="handlePickWorkspace" title="点击选择工作区">
                <Icon icon="mdi:folder-outline" width="14" /> {{ activeWorkspaceName }}
              </button>
              <button class="info-item info-item--btn" @click="handlePickWorkspace" title="本地工作区"><Icon icon="mdi:monitor" width="14" /> 本地</button>
              <button class="info-item info-item--btn" @click="handleBranchClick" :title="`当前分支: ${currentBranch}，点击查看`"><Icon icon="mdi:source-branch" width="14" /> {{ currentBranch }}</button>
              <span class="info-spacer" />
              <button class="info-icon" title="布局" @click="rightOpen = !rightOpen"><Icon icon="mdi:dock-right" width="14" /></button>
            </div>
            <ChatComposer
            v-model="input"
            :attachments="attachments"
            :running="chat.running"
            :workspace="chat.workspace"
            :workspace-name="chat.workspace ? activeWorkspaceName : '普通对话'"
            :model="settings.settings.model"
            :has-github="settings.hasGithubToken"
            :add-menu-actions="composerAddActions"
            :add-menu-plugins="composerPlugins"
            @update:attachments="attachments = $event"
            @submit="send"
            @stop="chat.stop"
            @select-add-action="handleAddAction"
            @select-plugin="handlePlugin"
            @request-approve="handleApprove"
            @rename="handleRename"
          />
          </div>
        </div>
      </section>

      <div v-if="rightOpen" class="right-shell">
        <div class="pane-resizer pane-resizer--left" title="拖动调整详情栏宽度" @mousedown="startResize('right', $event)" />
        <RightPanel />
      </div>
    </main>
  </div>
</template>

<style scoped>
.codex-window { display: flex; flex-direction: column; width: 100%; height: 100vh; min-height: 0; overflow: hidden; background: #fff; }
.window-bar {
  height: 28px; display: flex; align-items: center; justify-content: space-between;
  padding: 0 10px; background: #f1f5f5; border-bottom: 1px solid #e2e8f0; flex: 0 0 auto;
  font-size: 12px; color: #475569;
}
.window-bar-left { display: flex; align-items: center; gap: 10px; }
.win-dot { width: 8px; height: 8px; border-radius: 50%; background: #e2e8f0; border: 1px solid #cbd5e1; }
.win-nav { display: inline-flex; gap: 4px; color: #94a3b8; }
.win-menu { color: #64748b; cursor: default; }
.window-bar-right { display: flex; align-items: center; gap: 10px; }
.codex-version { display: inline-flex; align-items: center; gap: 6px; color: #475569; }
.dot-green { width: 8px; height: 8px; border-radius: 50%; background: #10b981; display: inline-block; }
.win-ctrl { width: 28px; height: 28px; display: grid; place-items: center; cursor: default; }
.win-ctrl:hover { background: rgba(0,0,0,0.06); }
.win-ctrl--close:hover { background: #ef4444; color: #fff; }

.workbench { display: grid; grid-template-columns: var(--left-pane-width) minmax(0, 1fr) var(--right-pane-width); width: 100%; flex: 1 1 auto; min-height: 0; overflow: hidden; background: #fff; }
.workbench--right-closed { grid-template-columns: var(--left-pane-width) minmax(0, 1fr); }
.left-pane { position: relative; display: flex; flex-direction: column; min-width: 0; min-height: 0; overflow: hidden; background: #f3f7f7; border-right: 1px solid #e6eef3; }
.center-pane { position: relative; display: flex; min-width: 0; min-height: 0; flex-direction: column; overflow: hidden; background: #fff; }
.message-scroll { position: relative; flex: 1 1 auto; min-width: 0; min-height: 0; overflow: auto; overscroll-behavior: contain; display: flex; flex-direction: column; }
.codex-empty { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 40px 20px 60px; text-align: center; }
.empty-icon { color: #cbd5e1; margin-bottom: 16px; }
.empty-title { font-size: 20px; font-weight: 600; color: #0f172a; margin: 0 0 28px; }
.empty-highlight { text-decoration: underline; text-decoration-style: dashed; text-underline-offset: 4px; text-decoration-color: #94a3b8; }
.suggestion-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 160px)); gap: 12px; }
.suggestion-card {
  display: flex; flex-direction: column; align-items: flex-start; gap: 24px;
  padding: 16px; border: 1px solid #e6eef3; border-radius: 10px; background: #fff;
  text-align: left; cursor: pointer; transition: box-shadow 0.15s, border-color 0.15s;
}
.suggestion-card:hover { border-color: #cbd5e1; box-shadow: 0 4px 12px rgba(0,0,0,0.06); }
.s-icon { flex: 0 0 auto; }
.s-blue { color: #0ea5e9; } .s-purple { color: #8b5cf6; } .s-green { color: #10b981; } .s-orange { color: #f97316; }
.suggestion-card span { font-size: 13px; color: #334155; line-height: 1.4; }

.message-navigator { position: absolute; top: 10px; right: 6px; bottom: 140px; z-index: 4; display: flex; width: 22px; flex-direction: column; align-items: center; justify-content: space-between; padding: 8px 0; pointer-events: none; }
.message-navigator::before { content: ''; position: absolute; top: 0; bottom: 0; left: 50%; width: 1px; transform: translateX(-50%); background: #e2e8f0; pointer-events: none; }
.message-marker { position: relative; z-index: 1; width: 22px; height: 14px; padding: 0; border: 0; border-radius: 3px; background: transparent; cursor: pointer; pointer-events: auto; }
.message-marker::after { content: ''; position: absolute; top: 50%; left: 50%; width: 14px; height: 3px; transform: translate(-50%, -50%); border-radius: 2px; background: color-mix(in srgb, #94a3b8 42%, transparent); transition: width 140ms ease, background-color 140ms ease; }
.message-marker:hover::after { width: 18px; background: #64748b; }
.message-marker.active::after { width: 20px; background: #0ea5e9; }
.message-marker--user::after { background: color-mix(in srgb, #0ea5e9 40%, #94a3b8); }
.message-list { width: min(900px, 100%); min-width: 0; margin: 0 auto; padding: 16px 20px 24px; }
.message { display: flex; min-width: 0; margin-bottom: 16px; }
.message--user { justify-content: flex-start; }
.user-message-wrap { max-width: min(820px, 100%); }
.user-message { display: flex; align-items: flex-start; gap: 8px; padding: 6px 0; color: #0f172a; white-space: pre-wrap; line-height: 1.55; flex-wrap: wrap; }
.message-attachments { display:flex; width:100%; gap:5px; flex-wrap:wrap; }
.message-attachment { display:inline-flex; align-items:center; gap:4px; padding:2px 6px; border:1px solid #e2e8f0; border-radius:3px; color:#475569; background:#f8fafc; font-size:11px; }
.edit-message { flex: 0 0 auto; display: grid; place-items: center; width: 22px; height: 22px; margin: 0; border: 0; border-radius: 3px; color: #64748b; background: transparent; cursor: pointer; opacity: 0; }
.user-message:hover .edit-message { opacity: 1; }
.edit-message:hover { color: #0f172a; background: #f1f5f9; }
.message-editor { width: min(820px, 100%); padding: 6px; border: 1px solid #0ea5e9; border-radius: 6px; background: #fff; }
.message-editor :deep(.el-textarea__inner) { border: 0; box-shadow: none; background: transparent; }
.editor-actions { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 6px 4px 0; color: #64748b; font-size: 11px; }
.editor-actions > div { display: flex; gap: 4px; }
.assistant-message { width: min(820px, 100%); min-width: 0; color: #0f172a; line-height: 1.6; }
.waiting { display: inline-flex; align-items: center; gap: 7px; color: #64748b; font-size: 13px; }

.composer-area { flex: 0 0 auto; padding: 0 16px 12px; background: #fff; }
.composer-combined {
  width: min(880px, 100%); margin: 0 auto; background: #fff; border: 1px solid #e6eef3; border-radius: 16px;
  overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.04);
}
.composer-info-bar {
  display: flex; align-items: center; gap: 8px; padding: 8px 12px;
  background: #f8fafc; border-bottom: 1px solid #eef2f6;
  font-size: 12px; color: #64748b;
}
.composer-area .composer { width: 100% !important; margin: 0 !important; border: 0 !important; border-radius: 0 !important; box-shadow: none !important; background: #fff !important; }
.info-item { display: inline-flex; align-items: center; gap: 6px; }
.info-item--btn {
  display: inline-flex; align-items: center; gap: 6px; padding: 4px 8px;
  border: 0; border-radius: 6px; background: transparent; color: #475569; font-size: 12px; cursor: pointer;
}
.info-item--btn:hover { background: #fff; color: #0f172a; box-shadow: 0 1px 4px rgba(0,0,0,0.06); }
.info-spacer { flex: 1; }
.info-icon { display: grid; place-items: center; width: 22px; height: 22px; border: 0; background: transparent; color: #94a3b8; cursor: pointer; border-radius: 4px; }
.info-icon:hover { background: #fff; color: #334155; }
.right-shell { position: relative; min-width: 0; min-height: 0; overflow: hidden; background: #f8fafc; border-left: 1px solid #e6eef3; }
.pane-resizer { position: absolute; top: 0; right: 0; z-index: 8; width: 6px; height: 100%; cursor: col-resize; }
.pane-resizer--left { right: auto; left: 0; }
.pane-resizer:hover, .pane-resizer:active { background: #0ea5e9; opacity: 0.3; }
@media (max-width: 1100px) { .suggestion-grid { grid-template-columns: repeat(2, minmax(0,1fr)); } }
@media (max-width: 860px) { .workbench { grid-template-columns: var(--left-pane-width) minmax(0, 1fr); } .right-shell { display: none; } .suggestion-grid { grid-template-columns: 1fr; } }
@media (max-width: 640px) { .composer-info-bar { display: none; } }
</style>
