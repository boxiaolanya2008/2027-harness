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
  ToolCall,
  Project
} from '@/types'

function uid() {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`
}

function blankConversation(workspace?: string, projectId?: string): Conversation {
  const now = Date.now()
  return { id: uid(), title: '新对话', messages: [], workspace, projectId, createdAt: now, updatedAt: now, protocolHistory: [] }
}

function asConversation(raw: any): Conversation {
  const now = Date.now()
  return {
    id: String(raw?.id || uid()),
    title: String(raw?.title || '新对话'),
    messages: Array.isArray(raw?.messages) ? raw.messages : [],
    workspace: typeof raw?.workspace === 'string' ? raw.workspace : undefined,
    projectId: typeof raw?.projectId === 'string' ? raw.projectId : undefined,
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
  const projects = ref<Project[]>([])
  const selectedProjectId = ref<string | null>(null)
  const expandedProjectIds = ref<string[]>([])
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
      repo: selectedRepoFullName.value ? { full_name: selectedRepoFullName.value } : null,
      selectedProjectId: selectedProjectId.value,
      expandedProjectIds: expandedProjectIds.value
    })
  }

  function applyActiveConversation(conversation: Conversation | null) {
    if (!conversation) return
    const project = conversation.projectId
      ? projects.value.find((item) => item.id === conversation.projectId && !item.archivedAt)
      : undefined
    if (project) {
      selectedProjectId.value = project.id
      workspace.value = project.workspace
      workspaces.value = [project.workspace, ...workspaces.value.filter((item) => item !== project.workspace)].slice(0, 12)
      if (conversation.workspace !== project.workspace) {
        conversation.workspace = project.workspace
        scheduleSave(conversation)
      }
    } else {
      selectedProjectId.value = null
      if (conversation.workspace) {
        workspace.value = conversation.workspace
        workspaces.value = [conversation.workspace, ...workspaces.value.filter((item) => item !== conversation.workspace)].slice(0, 12)
      }
    }
  }

  async function hydrate() {
    if (hydrated.value) return
    const [summaries, ui, storedProjects] = await Promise.all([
      window.api.conversations.list(),
      window.api.state.load(),
      window.api.projects.list()
    ])
    projects.value = storedProjects
    workspace.value = ui.selectedWorkspace
    workspaces.value = ui.recentWorkspaces || []
    selectedProjectId.value = ui.selectedProjectId
    expandedProjectIds.value = ui.expandedProjectIds || []
    rightPanelTab.value = ui.rightPanelTab === 'changes' ? 'changes' : 'github'
    selectedRepoFullName.value = typeof ui.repo?.full_name === 'string' ? ui.repo.full_name : null
    const loaded = await Promise.all(summaries.map((summary) => window.api.conversations.load(summary.id)))
    conversations.value = loaded.filter(Boolean).map(asConversation)
    currentId.value = conversations.value.some((conversation) => conversation.id === ui.currentConversationId)
      ? ui.currentConversationId
      : conversations.value[0]?.id || null
    applyActiveConversation(current())
    hydrated.value = true
  }

  async function selectWorkspace(path: string) {
    if (running.value) return
    const project = await window.api.projects.upsert({ workspace: path })
    projects.value = [project, ...projects.value.filter((item) => item.id !== project.id)]
    selectedProjectId.value = project.id
    workspace.value = project.workspace
    workspaces.value = [project.workspace, ...workspaces.value.filter((item) => item !== project.workspace)].slice(0, 12)
    const conversation = current()
    if (conversation && !conversation.messages.length) {
      conversation.workspace = project.workspace
      conversation.projectId = project.id
      scheduleSave(conversation)
    } else {
      const latest = [...conversations.value]
        .filter((item) => item.projectId === project.id)
        .sort((left, right) => (right.updatedAt || right.createdAt) - (left.updatedAt || left.createdAt))[0]
      currentId.value = latest?.id || null
    }
    await persistUiState()
  }

  async function selectProject(id: string | null) {
    if (running.value) return
    if (id === null) {
      selectedProjectId.value = null
      currentId.value = null
      await persistUiState()
      return
    }
    const project = projects.value.find((item) => item.id === id && !item.archivedAt)
    if (!project) return
    selectedProjectId.value = project.id
    workspace.value = project.workspace
    workspaces.value = [project.workspace, ...workspaces.value.filter((item) => item !== project.workspace)].slice(0, 12)
    const latest = [...conversations.value]
      .filter((item) => item.projectId === project.id)
      .sort((left, right) => (right.updatedAt || right.createdAt) - (left.updatedAt || left.createdAt))[0]
    currentId.value = latest?.id || null
    await persistUiState()
  }

  async function toggleProjectExpanded(id: string) {
    expandedProjectIds.value = expandedProjectIds.value.includes(id)
      ? expandedProjectIds.value.filter((item) => item !== id)
      : [...expandedProjectIds.value, id]
    await persistUiState()
  }

  async function archiveProject(id: string) {
    if (running.value) return
    const archived = await window.api.projects.archive(id)
    if (!archived) return
    projects.value = projects.value.map((item) => item.id === id ? archived : item)
    if (selectedProjectId.value === id) selectedProjectId.value = null
    await persistUiState()
  }

  function newConversation() {
    if (running.value) return current() || blankConversation(workspace.value || undefined, selectedProjectId.value || undefined)
    const project = selectedProjectId.value ? projects.value.find((item) => item.id === selectedProjectId.value && !item.archivedAt) : undefined
    const conversation = blankConversation(project?.workspace || workspace.value || undefined, project?.id)
    conversations.value.unshift(conversation)
    currentId.value = conversation.id
    void window.api.conversations.save(JSON.parse(JSON.stringify(conversation)))
    void persistUiState()
    return conversation
  }

  async function select(id: string) {
    if (running.value) return
    const conversation = conversations.value.find((item) => item.id === id)
    if (!conversation) return
    currentId.value = id
    applyActiveConversation(conversation)
    await persistUiState()
  }

  async function remove(id: string) {
    if (running.value) return
    conversations.value = conversations.value.filter((conversation) => conversation.id !== id)
    await window.api.conversations.remove(id)
    if (currentId.value === id) {
      currentId.value = conversations.value[0]?.id || null
      applyActiveConversation(current())
    }
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
        existing.writePreview = event.writePreview || existing.writePreview
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
        // Provider calls are announced as a batch while tools execute sequentially. Keep the
        // call adjacent to its first result so callId is an unambiguous timeline relation.
        const callIndex = events.findIndex((item) => item.type === 'tool_call' && item.callId === event.callId)
        if (callIndex >= 0) {
          const call = events.splice(callIndex, 1)[0]
          call.seq = event.seq - 0.5
          events.push(call)
        }
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
    projects,
    selectedProjectId,
    expandedProjectIds,
    rightPanelTab,
    selectedRepoFullName,
    hydrated,
    current,
    hydrate,
    persistUiState,
    selectWorkspace,
    selectProject,
    toggleProjectExpanded,
    archiveProject,
    newConversation,
    select,
    remove,
    stop,
    sendPrompt,
    editAndRegenerate,
    rollbackLatestTurn
  }
})
