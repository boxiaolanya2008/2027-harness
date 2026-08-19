import { streamTurn, type ChatMsg, type ProviderToolCall } from './openai'
import { TOOLS, SYSTEM, execTool } from './agent-tools'
import type { AssistantTurnEvent, AssistantTurnEventInput, Settings, StreamState, WriteFilePreview } from '@/types'

// The agent consumes and emits the same ordered turn event protocol as the provider stream.
export type AgentEvent = AssistantTurnEvent

export interface RunAgentResult {
  history: ChatMsg[]
  state: StreamState
}

type CompletedToolCall = Extract<AssistantTurnEvent, { type: 'tool_call' }>

function aborted(signal?: AbortSignal) {
  return signal?.aborted === true
}

function isMissingFileError(error: unknown) {
  const message = (error as Error).message || String(error)
  return /\bENOENT\b|no such file/i.test(message)
}

// This read occurs immediately before write execution and never fabricates an after state.
async function preflightWritePreview(workspace: string, args: Record<string, unknown>): Promise<WriteFilePreview | undefined> {
  if (typeof args.path !== 'string' || typeof args.content !== 'string') return undefined

  try {
    const before = await window.api.fs.read(workspace, args.path)
    return {
      path: args.path,
      before: { state: 'present', content: before },
      proposedContent: args.content,
      operation: 'modify'
    }
  } catch (error) {
    if (isMissingFileError(error)) {
      return {
        path: args.path,
        before: { state: 'missing', content: null },
        proposedContent: args.content,
        operation: 'create'
      }
    }
    return {
      path: args.path,
      before: { state: 'unknown', content: null, error: (error as Error).message || String(error) },
      proposedContent: args.content,
      operation: 'unknown'
    }
  }
}

function callSignature(calls: CompletedToolCall[]) {
  // rawArgs is used intentionally: it is the exact completed provider call, including malformed JSON.
  return JSON.stringify(calls.map((call) => [call.name || '', call.rawArgs]))
}

function writeChanged(content: string) {
  try {
    const snapshot = JSON.parse(content) as {
      before?: { exists?: boolean; content?: string | null }
      after?: { exists?: boolean; content?: string | null }
    }
    return snapshot.before?.exists !== snapshot.after?.exists || snapshot.before?.content !== snapshot.after?.content
  } catch {
    // A write without the authoritative snapshot cannot establish state progress.
    return false
  }
}

function changedState(name: string, content: string, failed: boolean) {
  if (failed) return false
  if (name === 'write_file') return writeChanged(content)
  // These tools only report success after their external state-changing operation completes.
  return name === 'git_commit' || name === 'git_new_branch' || name === 'git_push'
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
  const apiKey = await window.api.settings.getAiKeyForRequest()
  const messages: ChatMsg[] = history.length
    ? [...history]
    : [{ role: 'system', content: `${SYSTEM}\n当前工作区：${workspace}` }]
  messages.push({ role: 'user', content: taskPrompt })

  let seq = 0
  let state: StreamState = 'streaming'
  let nextCallId = 0
  let stateVersion = 0
  const completedSignatures = new Map<string, number>()
  const emit = (event: AssistantTurnEventInput) => {
    onEvent({ ...event, seq: ++seq, timestamp: Date.now() } as AgentEvent)
  }
  // Internal IDs must not inherit provider IDs: providers can omit or reuse them across rounds.
  const makeInternalCallId = () => `agent-call-${++nextCallId}`

  emit({ type: 'status', state: 'streaming' })

  while (true) {
    if (aborted(signal)) {
      state = 'aborted'
      emit({ type: 'status', state })
      return { history: messages, state }
    }

    const completedCalls: CompletedToolCall[] = []
    let text = ''
    let reasoning = ''
    let providerState: StreamState = 'streaming'

    for await (const streamedEvent of streamTurn(settings, apiKey, messages, TOOLS, signal, makeInternalCallId)) {
      // A provider's completed status only ends this model request. The full agent run can still have tools to run.
      if (streamedEvent.type === 'status') {
        providerState = streamedEvent.state
        if (streamedEvent.state !== 'completed') emit(streamedEvent)
        continue
      }

      if (streamedEvent.type === 'tool_call' && streamedEvent.phase === 'completed') {
        completedCalls.push(streamedEvent)
        emit(streamedEvent)
      } else {
        emit(streamedEvent)
      }

      if (streamedEvent.type === 'assistant_text') text += streamedEvent.text
      if (streamedEvent.type === 'reasoning') reasoning += streamedEvent.text
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

    const signature = callSignature(completedCalls)
    if (completedSignatures.get(signature) === stateVersion) {
      state = 'failed'
      const error = '检测到没有状态进展的重复工具调用，已停止以避免循环'
      emit({ type: 'error', error })
      emit({ type: 'status', state, error })
      // Do not append this assistant tool-call message: protocol history must not contain unanswered calls.
      return { history: messages, state }
    }

    const toolCalls: ProviderToolCall[] = completedCalls.map((call) => ({
      // Protocol correlation must use the provider's identifier when it supplied one.
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
    const toolMessages: ChatMsg[] = []
    const completeInterruptedBatch = (nextState: Extract<StreamState, 'aborted' | 'failed'>, reason: string) => {
      // A tool-call assistant message must have exactly one tool response for every call before
      // it can enter durable provider history, even when cancellation or an error skips later calls.
      for (const remaining of completedCalls.slice(toolMessages.length)) {
        const content = `错误: ${reason}`
        toolMessages.push({
          role: 'tool',
          tool_call_id: remaining.providerCallId || remaining.callId,
          name: remaining.name || '',
          content
        })
        emit({
          type: 'tool_result',
          callId: remaining.callId,
          providerCallId: remaining.providerCallId,
          name: remaining.name || '',
          status: 'failed',
          content,
          error: reason
        })
      }
      messages.push(assistantMessage, ...toolMessages)
      state = nextState
      if (nextState === 'failed') emit({ type: 'error', error: reason })
      emit({ type: 'status', state, ...(nextState === 'failed' ? { error: reason } : {}) })
      return { history: messages, state }
    }

    // Tool execution stays sequential, even when a provider supplied several calls in one delta stream.
    for (const call of completedCalls) {
      if (aborted(signal)) return completeInterruptedBatch('aborted', 'Agent 已取消，工具未执行')

      const name = call.name || ''
      const protocolCallId = call.providerCallId || call.callId
      if (name === 'write_file' && call.args) {
        const writePreview = await preflightWritePreview(workspace, call.args)
        if (writePreview) emit({ ...call, writePreview })
      }
      if (aborted(signal)) return completeInterruptedBatch('aborted', 'Agent 已取消，工具未执行')
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
          content = await execTool(workspace, name, call.args as Record<string, any>, context ? { ...context, toolCallId: call.callId } : undefined)
        } catch (error) {
          failure = (error as Error).message || String(error)
          content = `错误: ${failure}`
        }
      }

      if (changedState(name, content, Boolean(failure))) stateVersion += 1
      emit({
        type: 'tool_result',
        callId: call.callId,
        providerCallId: call.providerCallId,
        name,
        status: failure ? 'failed' : 'succeeded',
        content,
        error: failure
      })
      toolMessages.push({ role: 'tool', tool_call_id: protocolCallId, name, content })
      if (failure) return completeInterruptedBatch('failed', failure)
    }

    messages.push(assistantMessage, ...toolMessages)
    // Save the version after the batch. A matching batch can run again only after real state progress.
    completedSignatures.set(signature, stateVersion)
    emit({ type: 'status', state: 'streaming' })
  }
}
