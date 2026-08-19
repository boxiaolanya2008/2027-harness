import { streamTurn, type ChatMsg, type ProviderToolCall } from './openai'
import { TOOLS, SYSTEM, execTool } from './agent-tools'
import type { AssistantTurnEvent, AssistantTurnEventInput, Settings, StreamState } from '@/types'

// The agent consumes and emits the same ordered turn event protocol as the provider stream.
export type AgentEvent = AssistantTurnEvent

export interface RunAgentResult {
  history: ChatMsg[]
  state: StreamState
}

function aborted(signal?: AbortSignal) {
  return signal?.aborted === true
}

export async function runAgent(
  settingsStore: { settings: Settings },
  taskPrompt: string,
  workspace: string,
  onEvent: (event: AgentEvent) => void,
  signal?: AbortSignal,
  history: ChatMsg[] = [],
  context?: { conversationId: string; turnId: string }
): Promise<RunAgentResult> {
  const settings = settingsStore.settings
  const apiKey = (await window.api.settings.get()).aiKey
  const messages: ChatMsg[] = history.length
    ? [...history]
    : [{ role: 'system', content: `${SYSTEM}\n当前工作区：${workspace}` }]
  messages.push({ role: 'user', content: taskPrompt })

  let seq = 0
  let state: StreamState = 'streaming'
  const emit = (event: AssistantTurnEventInput) => {
    onEvent({ ...event, seq: ++seq, timestamp: Date.now() } as AgentEvent)
  }

  emit({ type: 'status', state: 'streaming' })

  for (let round = 0; round < 12; round++) {
    if (aborted(signal)) {
      state = 'aborted'
      emit({ type: 'status', state })
      return { history: messages, state }
    }

    const completedCalls: Extract<AssistantTurnEvent, { type: 'tool_call' }>[] = []
    let text = ''
    let reasoning = ''
    let providerState: StreamState = 'streaming'

    for await (const event of streamTurn(settings, apiKey, messages, TOOLS, signal)) {
      // A provider's completed status only ends this model request. The full Agent turn can still have tools to run.
      if (event.type === 'status') {
        providerState = event.state
        if (event.state !== 'completed') emit(event)
      } else {
        emit(event)
      }
      if (event.type === 'assistant_text') text += event.text
      if (event.type === 'reasoning') reasoning += event.text
      if (event.type === 'tool_call' && event.phase === 'completed') completedCalls.push(event)
    }

    if (providerState !== 'completed') {
      state = providerState
      return { history: messages, state }
    }

    if (!completedCalls.length) {
      const assistantMessage: ChatMsg = { role: 'assistant', content: text || null }
      if (reasoning) assistantMessage.reasoning_content = reasoning
      messages.push(assistantMessage)
      state = 'completed'
      emit({ type: 'status', state })
      return { history: messages, state }
    }

    const toolCalls: ProviderToolCall[] = completedCalls.map((call) => ({
      id: call.providerCallId || call.callId,
      type: 'function',
      function: {
        name: call.name || '',
        arguments: call.rawArgs
      }
    }))
    const assistantMessage: ChatMsg = {
      role: 'assistant',
      content: text || null,
      tool_calls: toolCalls
    }
    if (reasoning) assistantMessage.reasoning_content = reasoning
    messages.push(assistantMessage)

    // Tool execution stays sequential, even when a provider supplied several calls in one delta stream.
    for (const call of completedCalls) {
      if (aborted(signal)) {
        state = 'aborted'
        emit({ type: 'status', state })
        return { history: messages, state }
      }

      const name = call.name || ''
      const toolCallId = call.providerCallId || call.callId
      emit({
        type: 'tool_result',
        callId: call.callId,
        providerCallId: call.providerCallId,
        name,
        status: 'running'
      })

      let content: string
      let failure: string | undefined
      if (call.error) {
        failure = call.error
        content = `错误: ${failure}`
      } else if (!name) {
        failure = '工具调用缺少名称'
        content = `错误: ${failure}`
      } else if (!call.args) {
        failure = '工具调用缺少参数'
        content = `错误: ${failure}`
      } else {
        try {
          content = await execTool(workspace, name, call.args as Record<string, any>, context ? { ...context, toolCallId } : undefined)
        } catch (error) {
          failure = (error as Error).message || String(error)
          content = `错误: ${failure}`
        }
      }

      emit({
        type: 'tool_result',
        callId: call.callId,
        providerCallId: call.providerCallId,
        name,
        status: failure ? 'failed' : 'succeeded',
        content,
        error: failure
      })
      messages.push({ role: 'tool', tool_call_id: toolCallId, name, content })
    }

    emit({ type: 'status', state: 'streaming' })
  }

  state = 'failed'
  const error = '工具调用轮次超过 12 次'
  emit({ type: 'error', error })
  emit({ type: 'status', state, error })
  return { history: messages, state }
}
