import { defineStore } from 'pinia'
import { ref } from 'vue'
import { runAgent } from '@/api/agent'
import { streamTurn } from '@/api/openai'
import { useSettingsStore } from './settings'
import type {
  AssistantTurnEvent,
  Conversation,
  Message,
  ProviderHistoryMessage,
  ToolCall
} from '@/types'

function uid() {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`
}

function blankConversation(workspace?: string): Conversation {
  const now = Date.now()
  return { id: uid(), title: '新对话', messages: [], workspace, createdAt: now, updatedAt: now, protocolHistory: [] }
}

function asConversation(raw: any): Conversation {
  const now = Date.now()
  return {
    id: String(raw?.id || uid()),
    title: String(raw?.title || '新对话'),
    messages: Array.isArray(raw?.messages) ? raw.messages : [],
    workspace: typeof raw?.workspace === 'string' ? raw.workspace : undefined,
    protocolHistory: Array.isArray(raw?.protocolHistory) ? raw.protocolHistory : [],
    createdAt: Number(raw?.createdAt) || now,
    updatedAt: Number(raw?.updatedAt) || now
  }
}

export const useChatStore = defineStore('chat', () => {
  const conversations = ref<Conversation[]>([])
  const currentId = ref<string | null>(null)
  const running = ref(false)
  const workspace = ref<string | null>(null)
  const workspaces = ref<string[]>([])
  const rightPanelTab = ref('github')
  const selectedRepoFullName = ref<string | null>(null)
  const hydrated = ref(false)
  let abort: AbortController | null = null
  let activeRunId = 0
  const saveTimers = new Map<string, ReturnType<typeof setTimeout>>()

  const current = () => conversations.value.find((conversation) => conversation.id === currentId.value) || null

  function scheduleSave(conversation = current()) {
    if (!conversation) return
    conversation.updatedAt = Date.now()
    const previousTimer = saveTimers.get(conversation.id)
    if (previousTimer) clearTimeout(previousTimer)
    const timer = setTimeout(() => {
      saveTimers.delete(conversation!.id)
      void window.api.conversations.save(JSON.parse(JSON.stringify(conversation)))
    }, 180)
    saveTimers.set(conversation.id, timer)
  }

  async function persistUiState() {
    await window.api.state.save({
      selectedWorkspace: workspace.value,
      recentWorkspaces: workspaces.value,
      currentConversationId: currentId.value,
      rightPanelTab: rightPanelTab.value,
      repo: selectedRepoFullName.value ? { full_name: selectedRepoFullName.value } : null
    })
  }

  async function hydrate() {
    if (hydrated.value) return
    const [summaries, ui] = await Promise.all([window.api.conversations.list(), window.api.state.load()])
    workspace.value = ui.selectedWorkspace
    workspaces.value = ui.recentWorkspaces || []
    rightPanelTab.value = ui.rightPanelTab === 'changes' ? 'changes' : 'github'
    selectedRepoFullName.value = typeof ui.repo?.full_name === 'string' ? ui.repo.full_name : null
    const loaded = await Promise.all(summaries.map((summary) => window.api.conversations.load(summary.id)))
    conversations.value = loaded.filter(Boolean).map(asConversation)
    currentId.value = conversations.value.some((conversation) => conversation.id === ui.currentConversationId)
      ? ui.currentConversationId
      : conversations.value[0]?.id || null
    hydrated.value = true
  }

  async function selectWorkspace(path: string) {
    workspace.value = path
    workspaces.value = [path, ...workspaces.value.filter((item) => item !== path)].slice(0, 12)
    const conversation = current()
    if (conversation && !conversation.messages.length) conversation.workspace = path
    await persistUiState()
    scheduleSave(conversation)
  }

  function newConversation() {
    if (running.value) return current() || blankConversation(workspace.value || undefined)
    const conversation = blankConversation(workspace.value || undefined)
    conversations.value.unshift(conversation)
    currentId.value = conversation.id
    void window.api.conversations.save(JSON.parse(JSON.stringify(conversation)))
    return conversation
  }

  async function select(id: string) {
    if (running.value) return
    currentId.value = id
    await persistUiState()
  }

  async function remove(id: string) {
    if (running.value) return
    conversations.value = conversations.value.filter((conversation) => conversation.id !== id)
    await window.api.conversations.remove(id)
    if (currentId.value === id) currentId.value = conversations.value[0]?.id || null
    await persistUiState()
  }

  function stop() {
    abort?.abort()
    running.value = false
  }

  function ensureAssistantMessage(conversation: Conversation, id: string): Message {
    let message = conversation.messages.find((item) => item.id === id)
    if (!message) {
      message = { id, role: 'assistant', content: '', events: [], toolCalls: [], createdAt: Date.now() }
      conversation.messages.push(message)
    }
    message.events ||= []
    return message
  }

  function applyEvent(conversation: Conversation, messageId: string, incoming: AssistantTurnEvent) {
    const message = ensureAssistantMessage(conversation, messageId)
    const events = message.events!
    const event = { ...incoming, seq: events.length ? Math.max(...events.map((item) => item.seq)) + 1 : 1 }
    const previous = events[events.length - 1]
    const textDelta = event.type === 'assistant_text' ? event.text : ''

    if ((event.type === 'assistant_text' || event.type === 'reasoning') && previous?.type === event.type) {
      previous.text += event.text
    } else if (event.type === 'tool_call') {
      const existing = [...events].reverse().find((item) => item.type === 'tool_call' && item.callId === event.callId)
      if (existing && existing.type === 'tool_call') {
        existing.phase = event.phase
        existing.name ||= event.name
        existing.providerCallId ||= event.providerCallId
        existing.rawArgs = event.rawArgs || existing.rawArgs
        existing.argsFragment = `${existing.argsFragment || ''}${event.argsFragment || ''}`
        existing.args = event.args || existing.args
        existing.error = event.error || existing.error
      } else {
        events.push(event)
      }
    } else if (event.type === 'tool_result') {
      const existing = [...events].reverse().find((item) => item.type === 'tool_result' && item.callId === event.callId)
      if (existing && existing.type === 'tool_result') {
        existing.status = event.status
        existing.content = event.content || existing.content
        existing.error = event.error || existing.error
      } else {
        events.push(event)
      }
    } else {
      events.push(event)
    }

    if (textDelta) message.content += textDelta
    if (event.type === 'tool_result') {
      const call = message.toolCalls!.find((item) => item.id === event.callId)
      const mapped: ToolCall = {
        id: event.callId,
        name: event.name,
        args: {},
        status: event.status === 'succeeded' ? 'done' : event.status === 'failed' ? 'error' : 'running',
        result: event.content || event.error
      }
      if (call) Object.assign(call, mapped)
      else message.toolCalls!.push(mapped)
    }
    scheduleSave(conversation)
  }

  async function sendPrompt(text: string, options?: { existingUser?: Message }) {
    let conversation = current()
    if (!conversation) conversation = newConversation()
    if (!conversation.messages.length && text.length > 20) conversation.title = text.slice(0, 20)
    const historyBefore = conversation.protocolHistory || []
    const userMessage = options?.existingUser || {
      id: uid(),
      role: 'user' as const,
      content: text,
      protocolUserIndex: historyBefore.length ? historyBefore.length : (workspace.value ? 1 : 0),
      createdAt: Date.now()
    }
    if (!options?.existingUser) conversation.messages.push(userMessage)
    const assistantId = uid()
    const turnId = uid()
    userMessage.turnId = turnId
    const assistantMessage = ensureAssistantMessage(conversation, assistantId)
    assistantMessage.turnId = turnId
    const ws = conversation.workspace || workspace.value || undefined
    running.value = true
    const runId = ++activeRunId
    abort = new AbortController()
    scheduleSave(conversation)

    const emit = (event: AssistantTurnEvent) => {
      if (runId !== activeRunId) return
      applyEvent(conversation!, assistantId, event)
    }

    try {
      if (ws) {
        const result = await runAgent(
          useSettingsStore(),
          text,
          ws,
          emit,
          abort.signal,
          (conversation.protocolHistory || []) as any,
          { conversationId: conversation.id, turnId }
        )
        conversation.protocolHistory = result.history as ProviderHistoryMessage[]
      } else {
        const store = useSettingsStore()
        const key = (await window.api.settings.get()).aiKey
        const history = (conversation.protocolHistory || []) as any[]
        const messages = history.length ? [...history, { role: 'user', content: text }] : [{ role: 'user', content: text }]
        let output = ''
        let reasoning = ''
        for await (const event of streamTurn(store.settings, key, messages, undefined, abort.signal)) {
          emit(event)
          if (event.type === 'assistant_text') output += event.text
          if (event.type === 'reasoning') reasoning += event.text
        }
        conversation.protocolHistory = [
          ...messages,
          { role: 'assistant', content: output || null, ...(reasoning ? { reasoning_content: reasoning } : {}) }
        ]
      }
    } catch (error: any) {
      emit({ type: 'error', error: error.message || String(error), seq: 0, timestamp: Date.now() })
      emit({ type: 'status', state: 'failed', error: error.message || String(error), seq: 0, timestamp: Date.now() })
    } finally {
      if (runId === activeRunId) {
        running.value = false
        scheduleSave(conversation)
        await window.api.conversations.save(JSON.parse(JSON.stringify(conversation)))
      }
    }
  }

  async function rollbackLatestTurn(force = false) {
    if (running.value) throw new Error('Agent 正在运行，请等待当前任务结束')
    const conversation = current()
    if (!conversation) throw new Error('没有当前会话')
    const assistant = [...conversation.messages].reverse().find((message) => message.role === 'assistant' && message.turnId)
    if (!assistant?.turnId) throw new Error('当前会话没有可回退的 Agent 轮次')
    const changes = await window.api.changes.list({ conversationId: conversation.id, turnId: assistant.turnId })
    if (changes.length) await window.api.changes.restoreBatch({ changeIds: changes.map((change) => change.latestChangeId), force })
    const userIndex = conversation.messages.findIndex((message) => message.turnId === assistant.turnId && message.role === 'user')
    if (userIndex >= 0) {
      const user = conversation.messages[userIndex]
      conversation.messages = conversation.messages.slice(0, userIndex)
      if (typeof user.protocolUserIndex === 'number') conversation.protocolHistory = (conversation.protocolHistory || []).slice(0, user.protocolUserIndex)
    }
    scheduleSave(conversation)
    await window.api.conversations.save(JSON.parse(JSON.stringify(conversation)))
    return changes.length
  }

  async function editAndRegenerate(messageId: string, nextText: string) {
    if (running.value) throw new Error('Agent 正在运行，请等待当前任务结束')
    const conversation = current()
    const index = conversation?.messages.findIndex((message) => message.id === messageId) ?? -1
    if (!conversation || index < 0 || conversation.messages[index].role !== 'user') throw new Error('只能编辑当前会话中的用户消息')
    const text = nextText.trim()
    if (!text) throw new Error('消息不能为空')

    const target = conversation.messages[index]
    const protocolIndex = typeof target.protocolUserIndex === 'number'
      ? target.protocolUserIndex
      : (() => {
          const userOrdinal = conversation.messages.slice(0, index + 1).filter((message) => message.role === 'user').length - 1
          let seen = 0
          return (conversation.protocolHistory || []).findIndex((message) => {
            if (message.role !== 'user') return false
            if (seen === userOrdinal) return true
            seen += 1
            return false
          })
        })()
    conversation.messages = conversation.messages.slice(0, index + 1)
    target.content = text
    conversation.protocolHistory = (conversation.protocolHistory || []).slice(0, Math.max(0, protocolIndex))
    scheduleSave(conversation)
    await window.api.conversations.save(JSON.parse(JSON.stringify(conversation)))
    await sendPrompt(text, { existingUser: target })
  }

  return {
    conversations,
    currentId,
    running,
    workspace,
    workspaces,
    rightPanelTab,
    selectedRepoFullName,
    hydrated,
    current,
    hydrate,
    persistUiState,
    selectWorkspace,
    newConversation,
    select,
    remove,
    stop,
    sendPrompt,
    editAndRegenerate,
    rollbackLatestTurn
  }
})
