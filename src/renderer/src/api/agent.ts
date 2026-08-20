import { streamTurn, type ChatMsg, type ProviderToolCall, type ChatContentPart, type RequestConfig } from './openai'
import { TOOLS, SYSTEM, execTool } from './agent-tools'
import type { ToolDef } from './openai'
import type { ApprovalMode, AssistantTurnEvent, AssistantTurnEventInput, FileEditPreview, Settings, StreamState } from '@/types'
import { assessShellCommand } from '@/utils/shellSafety'
import { formatBlockedMessage, formatDeniedMessage, guardShellCommand } from '@/utils/shellGuard'
import { ElMessageBox } from 'element-plus'
import { useSettingsStore } from '@/stores/settings'

function getApprovalMode(): ApprovalMode {
  try {
    const store = useSettingsStore()
    const m = store.settings.approvalMode
    if (m === 'request' || m === 'help' || m === 'full') return m as ApprovalMode
  } catch {}
  try {
    const settingsRaw = localStorage.getItem('super-agent-settings')
    if (settingsRaw) {
      const raw = JSON.parse(settingsRaw) as Record<string, unknown>
      const m = raw.approvalMode
      if (m === 'request' || m === 'help' || m === 'full') return m as ApprovalMode
    }
  } catch {}
  return 'help'
}

function isWriteTool(name: string) {
  return name === 'write_file' || name === 'incrementally_edit'
}
function isComputerControlEnabled(): boolean {
  try { return localStorage.getItem('codex_computer_control') !== 'false' } catch { return true }
}
function isBrowserEnabled(): boolean {
  try { return localStorage.getItem('codex_browser_enabled') !== 'false' } catch { return true }
}
function isDefaultPermissionEnabled(): boolean {
  try { return localStorage.getItem('codex_default_permission') !== 'false' } catch { return true }
}
function getFilteredTools(): ToolDef[] {
  let tools = [...TOOLS]
  if (!isComputerControlEnabled()) {
    tools = tools.filter(t => !['run_command', 'git_commit', 'git_new_branch', 'git_push', 'git_status', 'git_diff'].includes(t.function.name))
  }
  if (!isBrowserEnabled()) {
    // currently no dedicated browser tool, keep as is
  }
  return tools
}

async function requestToolApproval(toolName: string, toolArgs: Record<string, unknown>): Promise<boolean> {
  const mode = getApprovalMode()
  if (mode === 'full') return true
  const defaultPerm = isDefaultPermissionEnabled()
  // help 模式：仅当默认权限开启时，写入类自动批准；否则一律需确认
  if (mode === 'help' && isWriteTool(toolName) && defaultPerm) return true

  const summary = (() => {
    const a = toolArgs as Record<string, unknown>
    if (toolName === 'read_file') return `读取文件: ${String(a.path || '')}`
    if (toolName === 'write_file') return `写入文件: ${String(a.path || '')}`
    if (toolName === 'incrementally_edit') return `编辑文件: ${String(a.path || '')}`
    if (toolName === 'run_command') return `执行命令: ${String(a.command || '').slice(0, 300)}`
    if (toolName === 'list_dir') return `列目录: ${String(a.path || '.')}`
    if (toolName === 'git_status') return 'git status'
    if (toolName === 'git_diff') return 'git diff'
    if (toolName === 'git_commit') return `git commit: ${String(a.message || '').slice(0, 120)}`
    if (toolName === 'git_new_branch') return `新建分支: ${String(a.branch || '')}`
    if (toolName === 'git_push') return `推送分支: ${String(a.branch || '')}`
    return `${toolName} ${JSON.stringify(a).slice(0, 300)}`
  })()

  const title = mode === 'request' ? '请求批准 - 工具调用' : '帮我批准 - 确认工具调用'
  try {
    await ElMessageBox.confirm(
      `${summary}\n\n是否允许运行此工具？`,
      title,
      {
        confirmButtonText: '允许',
        cancelButtonText: '拒绝',
        type: mode === 'request' ? 'warning' : 'info',
        showClose: true,
        distinguishCancelAndClose: true
      }
    )
    return true
  } catch {
    return false
  }
}

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

function createAnsiNormalizer() {
  let pending = ''
  const strip = (value: string, final = false) => {
    let text = `${pending}${value}`.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
    pending = ''
    const lastEscape = text.lastIndexOf('\u001b')
    if (!final && lastEscape >= 0 && !/[A-Za-z\\~]/.test(text.slice(lastEscape + 1))) {
      pending = text.slice(lastEscape)
      text = text.slice(0, lastEscape)
    }
    return text.replace(/\u001b\][\s\S]*?(?:\u0007|\u001b\\\\)/g, '').replace(/\u001b\[[0-?]*[ -/]*[@-~]/g, '').replace(/\u001b[()][0-9A-Za-z]/g, '')
  }
  return { strip, flush: () => strip('', true) }
}

function appendBoundedOutput(current: string, chunk: string, limit = 256 * 1024) {
  const next = current + chunk
  return next.length > limit ? `[输出已截断，仅保留最后 ${limit / 1024} KiB]\n${next.slice(-limit)}` : next
}

// This read occurs immediately before file mutation and never fabricates an after state.
async function preflightFileEditPreview(
  workspace: string,
  name: string,
  args: Record<string, unknown>
): Promise<FileEditPreview | undefined> {
  if (typeof args.path !== 'string') return undefined
  const isWrite = name === 'write_file'
  const isIncrementalEdit = name === 'incrementally_edit'
  if (!isWrite && !isIncrementalEdit) return undefined
  if (isWrite && typeof args.content !== 'string') return undefined
  if (isIncrementalEdit && (typeof args.old_string !== 'string' || typeof args.new_string !== 'string')) return undefined

  try {
    const beforeContent = await window.api.fs.read(workspace, args.path)
    let proposedContent: string
    if (isWrite) {
      proposedContent = args.content as string
    } else {
      const oldString = args.old_string as string
      const newString = args.new_string as string
      const firstMatch = beforeContent.indexOf(oldString)
      const secondMatch = beforeContent.indexOf(oldString, firstMatch + oldString.length)
      // Do not show a proposed state the main process will reject.
      if (firstMatch < 0 || (args.replace_all !== true && secondMatch >= 0)) return undefined
      proposedContent = args.replace_all === true
        ? beforeContent.split(oldString).join(newString)
        : `${beforeContent.slice(0, firstMatch)}${newString}${beforeContent.slice(firstMatch + oldString.length)}`
    }
    return {
      path: args.path,
      before: { state: 'present', content: beforeContent },
      proposedContent,
      operation: 'modify'
    }
  } catch (error) {
    if (isWrite && isMissingFileError(error)) {
      return {
        path: args.path,
        before: { state: 'missing', content: null },
        proposedContent: args.content as string,
        operation: 'create'
      }
    }
    return {
      path: args.path,
      before: { state: 'unknown', content: null, error: (error as Error).message || String(error) },
      proposedContent: '',
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
  if (name === 'write_file' || name === 'incrementally_edit') return writeChanged(content)
  // These tools only report success after their external state-changing operation completes.
  return name === 'git_commit' || name === 'git_new_branch' || name === 'git_push'
}

export async function runAgent(
  settingsStore: { settings: Settings },
  taskPrompt: string | ChatContentPart[],
  workspace: string,
  onEvent: (event: AgentEvent) => void,
  signal?: AbortSignal,
  history: ChatMsg[] = [],
  context?: { conversationId: string; turnId: string },
  requestConfig?: RequestConfig
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

    for await (const streamedEvent of streamTurn(settings, apiKey, messages, getFilteredTools(), signal, makeInternalCallId, requestConfig)) {
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
      if (call.args) {
        const fileEditPreview = await preflightFileEditPreview(workspace, name, call.args)
        if (fileEditPreview) emit({ ...call, fileEditPreview })
      }
      if (aborted(signal)) return completeInterruptedBatch('aborted', 'Agent 已取消，工具未执行')

      const approvalMode = getApprovalMode()

      // Critical shell commands are always blocked unless user selected "完全访问" (full)
      if (approvalMode !== 'full' && name === 'run_command' && call.args && typeof (call.args as Record<string, unknown>).command === 'string') {
        const command = String((call.args as Record<string, unknown>).command || '')
        const quickAssessment = assessShellCommand(command)
        if (quickAssessment?.level === 'critical') {
          const reason = formatBlockedMessage(quickAssessment, command)
          emit({ type: 'tool_result', callId: call.callId, providerCallId: call.providerCallId, name, status: 'failed', content: `错误: ${reason}`, error: reason })
          toolMessages.push({ role: 'tool', tool_call_id: protocolCallId, name, content: `错误: ${reason}` })
          return completeInterruptedBatch('failed', reason)
        }
      }

      // Codex-style approval: 请求批准=所有工具, 帮我批准=仅写入自动, 完全访问=全部自动
      if (approvalMode !== 'full') {
        const needsApproval = approvalMode === 'request' ? true : !isWriteTool(name)
        if (needsApproval) {
          const approved = await requestToolApproval(name, (call.args as Record<string, unknown>) || {})
          if (!approved) {
            const reason = `用户拒绝运行工具 ${name || 'unknown_tool'}`
            emit({ type: 'tool_result', callId: call.callId, providerCallId: call.providerCallId, name, status: 'failed', content: `错误: ${reason}`, error: reason })
            toolMessages.push({ role: 'tool', tool_call_id: protocolCallId, name, content: `错误: ${reason}` })
            return completeInterruptedBatch('failed', reason)
          }
        }
      }

      // Risky shell guard: only when not already approved via generic approval (to avoid double prompt)
      // For "help" writes auto case and "full" bypass, this is the only risky check.
      if (approvalMode !== 'full' && name === 'run_command' && call.args && typeof (call.args as Record<string, unknown>).command === 'string') {
        const command = String((call.args as Record<string, unknown>).command || '')
        const quickAssessment = assessShellCommand(command)
        // If we already prompted via generic approval for this run_command (needsApproval true), skip duplicate guard
        const alreadyPrompted = approvalMode === 'request' || (approvalMode === 'help' && !isWriteTool(name))
        if (quickAssessment && !alreadyPrompted) {
          const guard = await guardShellCommand(command)
          if (guard.decision !== 'allow') {
            const isBlocked = guard.decision === 'blocked'
            const reason = isBlocked ? formatBlockedMessage(guard.assessment!, command) : formatDeniedMessage(guard.assessment!, command)
            emit({ type: 'tool_result', callId: call.callId, providerCallId: call.providerCallId, name, status: 'failed', content: `错误: ${reason}`, error: reason })
            toolMessages.push({ role: 'tool', tool_call_id: protocolCallId, name, content: `错误: ${reason}` })
            return completeInterruptedBatch('failed', reason)
          }
        }
      }
      emit({
        type: 'tool_result',
        callId: call.callId,
        providerCallId: call.providerCallId,
        name,
        status: 'running'
      })

      let liveOutput = ''
      const ansi = createAnsiNormalizer()
      const unsubscribe = name === 'run_command'
        ? window.api.shell.onOutput(({ toolCallId, chunk }) => {
          if (toolCallId !== call.callId) return
          const clean = ansi.strip(chunk)
          if (!clean) return
          liveOutput = appendBoundedOutput(liveOutput, clean)
          emit({
            type: 'tool_result',
            callId: call.callId,
            providerCallId: call.providerCallId,
            name,
            status: 'running',
            liveOutput
          })
        })
        : undefined

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
        } finally {
          if (unsubscribe) {
            const trailing = ansi.flush()
            if (trailing) liveOutput = appendBoundedOutput(liveOutput, trailing)
            unsubscribe()
          }
        }
      }

      if (name === 'run_command') content = content.replace(/\u001b\][\s\S]*?(?:\u0007|\u001b\\\\)/g, '').replace(/\u001b\[[0-?]*[ -/]*[@-~]/g, '').replace(/\u001b[()][0-9A-Za-z]/g, '')
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
