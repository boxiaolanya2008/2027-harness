import { defineStore } from 'pinia'
import { ref } from 'vue'
import { runAgent } from '@/api/agent'
import { streamChat } from '@/api/openai'
import { useSettingsStore } from './settings'
import type { Conversation, Message, ToolCall } from '@/types'

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7)
}

export const useChatStore = defineStore('chat', () => {
  const conversations = ref<Conversation[]>([])
  const currentId = ref<string | null>(null)
  const running = ref(false)
  const workspace = ref<string | null>(null)
  let abort: AbortController | null = null

  const current = () => conversations.value.find((c) => c.id === currentId.value) || null

  function newConversation() {
    const conv: Conversation = {
      id: uid(),
      title: '新对话',
      messages: [],
      workspace: workspace.value || undefined,
      createdAt: Date.now()
    }
    conversations.value.unshift(conv)
    currentId.value = conv.id
    return conv
  }

  function select(id: string) {
    currentId.value = id
  }

  function remove(id: string) {
    conversations.value = conversations.value.filter((c) => c.id !== id)
    if (currentId.value === id) currentId.value = conversations.value[0]?.id || null
  }

  function stop() {
    abort?.abort()
    running.value = false
  }

  async function sendPrompt(text: string) {
    let conv = current()
    if (!conv) conv = newConversation()
    if (!conv.messages.length && text.length > 20) conv.title = text.slice(0, 20)

    conv.messages.push({ id: uid(), role: 'user', content: text, createdAt: Date.now() })
    const assistantId = uid()
    conv.messages.push({
      id: assistantId,
      role: 'assistant',
      content: '',
      toolCalls: [],
      createdAt: Date.now()
    })

    const ws = workspace.value || conv.workspace
    running.value = true
    abort = new AbortController()

    const emit = (ev: any) => {
      const m = conv!.messages.find((x) => x.id === assistantId)
      if (!m) return
      if (ev.type === 'text') m.content += ev.content || ''
      else if (ev.type === 'tool_start') {
        m.toolCalls!.push({
          id: ev.toolCallId,
          name: ev.toolName,
          args: ev.toolArgs,
          status: 'running'
        } as ToolCall)
      } else if (ev.type === 'tool_result') {
        const tc = m.toolCalls!.find((t) => t.id === ev.toolCallId)
        if (tc) {
          tc.status = 'done'
          tc.result = ev.content
        }
      } else if (ev.type === 'error') {
        m.content += `\n\n> ⚠️ ${ev.content}`
      }
    }

    try {
      if (ws) {
        await runAgent(useSettingsStore(), text, ws, emit, abort.signal)
      } else {
        const s = useSettingsStore()
        const key = (await window.api.settings.get()).aiKey
        for await (const ev of streamChat(s.settings, key, [
          { role: 'user', content: text }
        ], undefined, abort.signal)) {
          if (ev.type === 'delta') emit({ type: 'text', content: ev.content })
        }
      }
    } catch (e: any) {
      const m = conv.messages.find((x) => x.id === assistantId)
      if (m && !m.content) m.content = `执行出错：${e.message}`
    } finally {
      running.value = false
    }
  }

  return {
    conversations,
    currentId,
    running,
    workspace,
    current,
    newConversation,
    select,
    remove,
    stop,
    sendPrompt
  }
})
