<script setup lang="ts">
import { ref, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { Icon } from '@iconify/vue'
import GlassCard from '@/components/GlassCard.vue'
import MarkdownView from '@/components/MarkdownView.vue'
import ToolCallLog from '@/components/ToolCallLog.vue'
import EmptyState from '@/components/EmptyState.vue'
import RightPanel from '@/components/RightPanel.vue'
import { useChatStore } from '@/stores/chat'

const router = useRouter()
const chat = useChatStore()

const input = ref('')
const listRef = ref<HTMLElement | null>(null)

function send() {
  const text = input.value.trim()
  if (!text || chat.running) return
  input.value = ''
  chat.sendPrompt(text)
  scrollDown()
}

function scrollDown() {
  nextTick(() => {
    listRef.value?.scrollTo({ top: listRef.value.scrollHeight })
  })
}
</script>

<template>
  <div class="layout">
    <aside class="conv-col">
      <div class="conv-head">
        <button class="new-btn" @click="chat.newConversation()">
          <Icon icon="mdi:plus" width="16" /> 新对话
        </button>
      </div>
      <div class="conv-list">
        <button
          v-for="c in chat.conversations"
          :key="c.id"
          class="conv-item"
          :class="{ active: c.id === chat.currentId }"
          @click="chat.select(c.id)"
        >
          <span class="conv-title">{{ c.title }}</span>
          <span class="conv-close" @click.stop="chat.remove(c.id)">×</span>
        </button>
        <EmptyState v-if="!chat.conversations.length" title="还没有对话" desc="点上面的「新对话」开始。" />
      </div>
      <div class="conv-foot">
        <button class="foot-btn" @click="router.push('/settings')">
          <Icon icon="mdi:cog" width="16" /> 设置
        </button>
      </div>
    </aside>

    <main class="chat-main">
      <div ref="listRef" class="messages">
        <template v-if="chat.current()">
          <div v-for="m in chat.current()!.messages" :key="m.id" class="msg" :class="m.role">
            <div class="msg-bubble glass-card">
              <ToolCallLog v-if="m.toolCalls?.length" :calls="m.toolCalls" />
              <MarkdownView v-if="m.content" :content="m.content" />
              <span v-if="!m.content && m.role === 'assistant'" class="typing">
                <Icon icon="mdi:dots-horizontal" width="24" />
              </span>
            </div>
          </div>
        </template>
        <EmptyState
          v-else
          title="Super-Agent"
          desc="选一个工作区，然后直接给我任务——读代码、改代码、跑命令、提 PR，我都能做。"
        />
      </div>

      <div class="input-bar">
        <el-input
          v-model="input"
          type="textarea"
          :rows="2"
          resize="none"
          placeholder="给 Agent 下任务，或问代码库 / GitHub…（Enter 发送，Shift+Enter 换行）"
          @keydown.enter.exact.prevent="send"
        />
        <div class="input-actions">
          <el-button v-if="chat.running" type="danger" text @click="chat.stop()">停止</el-button>
          <el-button type="primary" :disabled="!input.trim() || chat.running" @click="send">发送</el-button>
        </div>
      </div>
    </main>

    <aside class="side-col">
      <RightPanel />
    </aside>
  </div>
</template>

<style scoped>
.layout {
  display: grid;
  grid-template-columns: 240px 1fr 340px;
  height: 100vh;
  gap: var(--space-4);
  padding: var(--space-4);
}
.conv-col,
.side-col {
  display: flex;
  flex-direction: column;
}
.conv-col {
  background: var(--panel-bg);
  border-radius: var(--radius-lg);
  padding: var(--space-3);
}
.conv-head {
  padding-bottom: var(--space-3);
}
.new-btn {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  padding: var(--space-2);
  background: var(--glass-bg);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-sm);
  color: var(--text-primary);
  cursor: pointer;
}.new-btn:hover {
  border-color: var(--accent);
}
.conv-list {
  flex: 1;
  overflow-y: auto;
}
.conv-item {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  background: transparent;
  border: none;
  border-radius: var(--radius-sm);
  color: var(--text-secondary);
  cursor: pointer;
}
.conv-item.active {
  background: rgba(110, 168, 255, 0.15);
}
.conv-title {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.conv-close {
  opacity: 0;
}
.conv-item:hover .conv-close {
  opacity: 1;
}
.conv-foot {
  padding-top: var(--space-2);
}
.foot-btn {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  padding: var(--space-2);
  background: transparent;
  border: none;
  color: var(--text-secondary);
}
.chat-main {
  display: flex;
  flex-direction: column;
}
.messages {
  flex: 1;
  overflow-y: auto;
}
.msg {
  display: flex;
}
.msg.user {
  justify-content: flex-end;
}
.msg-bubble {
  max-width: min(760px, 88%);
  padding: var(--space-4);
}
.msg.user .msg-bubble {
  background: rgba(110, 168, 255, 0.14);
}
.input-bar {
  padding-top: var(--space-3);
}
.input-actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-2);
}
.typing {
  display: inline-flex;
}
.side-col {
  overflow-y: auto;
}
</style>
