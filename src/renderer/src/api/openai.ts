import type { AssistantTurnEvent, AssistantTurnEventInput, Settings, StreamStatusEvent } from '@/types'

export interface ChatMsg {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content?: string | null
  tool_calls?: ProviderToolCall[]
  tool_call_id?: string
  name?: string
  // Some compatible providers expect returned reasoning alongside tool calls.
  reasoning_content?: string
}

export interface ProviderToolCall {
  id: string
  type: 'function'
  function: {
    name: string
    arguments: string
  }
}

export interface ToolDef {
  type: 'function'
  function: {
    name: string
    description: string
    parameters: Record<string, any>
  }
}

// Compatibility shape for the untouched store. Use streamTurn for the ordered event protocol.
export interface StreamEvent {
  type: 'delta' | 'tool_call' | 'done'
  content?: string
  toolCall?: { id: string; name: string; args: Record<string, any> }
}

interface PendingToolCall {
  callId: string
  providerCallId?: string
  index: number
  name?: string
  rawArgs: string
}

function makeEvent(seq: number, event: AssistantTurnEventInput): AssistantTurnEvent {
  return { ...event, seq, timestamp: Date.now() } as AssistantTurnEvent
}

function parseArgs(rawArgs: string): { args?: Record<string, unknown>; error?: string } {
  if (!rawArgs.trim()) return { args: {} }
  try {
    const parsed = JSON.parse(rawArgs)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return { args: parsed as Record<string, unknown> }
    }
    return { error: '工具参数必须是 JSON 对象' }
  } catch (error) {
    return { error: `工具参数不是有效 JSON: ${(error as Error).message}` }
  }
}

function statusFromChunk(chunk: any): { finishReason?: string | null; usage?: StreamStatusEvent['usage'] } {
  const choice = chunk.choices?.[0]
  return {
    finishReason: choice?.finish_reason,
    usage: chunk.usage
  }
}

async function* sseRecords(body: ReadableStream<Uint8Array>): AsyncGenerator<string> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let dataLines: string[] = []

  const flush = (): string | undefined => {
    if (!dataLines.length) return undefined
    const record = dataLines.join('\n')
    dataLines = []
    return record
  }

  const consumeLines = function* (final = false): Generator<string> {
    const lines = buffer.split(/\r\n|\n|\r/)
    buffer = final ? '' : lines.pop() || ''
    for (const line of lines) {
      if (!line) {
        const record = flush()
        if (record !== undefined) yield record
      } else if (line.startsWith('data:')) {
        let data = line.slice(5)
        if (data.startsWith(' ')) data = data.slice(1)
        dataLines.push(data)
      }
    }
  }

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      yield* consumeLines()
    }
    buffer += decoder.decode()
    yield* consumeLines(true)
    const record = flush()
    if (record !== undefined) yield record
  } finally {
    reader.releaseLock()
  }
}

// Normalizes OpenAI-compatible chat/completions SSE into ordered assistant-turn events.
export async function* streamTurn(
  settings: Settings,
  apiKey: string,
  messages: ChatMsg[],
  tools?: ToolDef[],
  signal?: AbortSignal
): AsyncGenerator<AssistantTurnEvent> {
  const body: Record<string, unknown> = {
    model: settings.model,
    messages,
    stream: true
  }
  if (tools?.length) body.tools = tools

  let res: Response
  try {
    res = await fetch(`${settings.apiBaseUrl.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify(body),
      signal
    })
  } catch (error) {
    if (signal?.aborted || (error as { name?: string }).name === 'AbortError') {
      yield makeEvent(1, { type: 'status', state: 'aborted' })
      return
    }
    const message = (error as Error).message || String(error)
    yield makeEvent(1, { type: 'error', error: message })
    yield makeEvent(2, { type: 'status', state: 'failed', error: message })
    return
  }

  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    const error = `AI 请求失败 (${res.status}): ${detail.slice(0, 300)}`
    yield makeEvent(1, { type: 'error', error })
    yield makeEvent(2, { type: 'status', state: 'failed', error })
    return
  }
  if (!res.body) {
    const error = 'AI 响应没有流式内容'
    yield makeEvent(1, { type: 'error', error })
    yield makeEvent(2, { type: 'status', state: 'failed', error })
    return
  }

  let seq = 0
  let finishReason: string | null | undefined
  let usage: StreamStatusEvent['usage']
  let receivedDone = false
  const calls = new Map<number, PendingToolCall>()

  try {
    for await (const data of sseRecords(res.body)) {
      if (data === '[DONE]') {
        receivedDone = true
        continue
      }

      let chunk: any
      try {
        chunk = JSON.parse(data)
      } catch {
        continue
      }

      const chunkStatus = statusFromChunk(chunk)
      if (chunkStatus.finishReason !== undefined) finishReason = chunkStatus.finishReason
      if (chunkStatus.usage !== undefined) usage = chunkStatus.usage

      const choice = chunk.choices?.[0]
      const delta = choice?.delta || {}
      if (typeof delta.content === 'string' && delta.content) {
        yield makeEvent(++seq, { type: 'assistant_text', text: delta.content })
      }

      for (const field of ['reasoning_content', 'reasoning', 'reasoning_text']) {
        if (typeof delta[field] === 'string' && delta[field]) {
          yield makeEvent(++seq, { type: 'reasoning', text: delta[field] })
        }
      }

      if (Array.isArray(delta.tool_calls)) {
        for (const fragment of delta.tool_calls) {
          const index = typeof fragment.index === 'number' ? fragment.index : calls.size
          let call = calls.get(index)
          if (!call) {
            call = {
              callId: fragment.id || `call_${index}`,
              providerCallId: fragment.id,
              index,
              rawArgs: ''
            }
            calls.set(index, call)
            yield makeEvent(++seq, {
              type: 'tool_call',
              callId: call.callId,
              providerCallId: call.providerCallId,
              index,
              phase: 'started',
              name: fragment.function?.name,
              rawArgs: call.rawArgs
            })
          }

          if (fragment.id && !call.providerCallId) {
            call.providerCallId = fragment.id
          }
          if (typeof fragment.function?.name === 'string') call.name = fragment.function.name
          if (typeof fragment.function?.arguments === 'string' && fragment.function.arguments) {
            call.rawArgs += fragment.function.arguments
            yield makeEvent(++seq, {
              type: 'tool_call',
              callId: call.callId,
              providerCallId: call.providerCallId,
              index,
              phase: 'arguments',
              name: call.name,
              argsFragment: fragment.function.arguments,
              rawArgs: call.rawArgs
            })
          }
        }
      }
    }

    for (const call of calls.values()) {
      const parsed = parseArgs(call.rawArgs)
      yield makeEvent(++seq, {
        type: 'tool_call',
        callId: call.callId,
        providerCallId: call.providerCallId,
        index: call.index,
        phase: 'completed',
        name: call.name,
        rawArgs: call.rawArgs,
        args: parsed.args,
        error: parsed.error
      })
    }

    yield makeEvent(++seq, {
      type: 'status',
      state: 'completed',
      finishReason: finishReason ?? (receivedDone ? 'stop' : undefined),
      usage
    })
  } catch (error) {
    if (signal?.aborted || (error as { name?: string }).name === 'AbortError') {
      yield makeEvent(++seq, { type: 'status', state: 'aborted' })
      return
    }
    const message = (error as Error).message || String(error)
    yield makeEvent(++seq, { type: 'error', error: message })
    yield makeEvent(++seq, { type: 'status', state: 'failed', error: message })
  }
}

// Plain streaming chat compatibility API used by the non-workspace conversation path.
export async function* streamChat(
  settings: Settings,
  apiKey: string,
  messages: ChatMsg[],
  tools?: ToolDef[],
  signal?: AbortSignal
): AsyncGenerator<StreamEvent> {
  for await (const event of streamTurn(settings, apiKey, messages, tools, signal)) {
    if (event.type === 'assistant_text') {
      yield { type: 'delta', content: event.text }
    } else if (event.type === 'tool_call' && event.phase === 'completed' && event.name && event.args) {
      yield {
        type: 'tool_call',
        toolCall: { id: event.callId, name: event.name, args: event.args as Record<string, any> }
      }
    } else if (event.type === 'status' && event.state === 'completed') {
      yield { type: 'done' }
    }
  }
}

// Compatibility collector. Agent execution consumes streamTurn directly to retain the full event order.
export async function collectChat(
  settings: Settings,
  apiKey: string,
  messages: ChatMsg[],
  tools?: ToolDef[],
  onDelta?: (d: string) => void,
  signal?: AbortSignal
): Promise<{ text: string; calls: NonNullable<StreamEvent['toolCall']>[] }> {
  let text = ''
  const calls: NonNullable<StreamEvent['toolCall']>[] = []
  for await (const event of streamTurn(settings, apiKey, messages, tools, signal)) {
    if (event.type === 'assistant_text') {
      text += event.text
      onDelta?.(event.text)
    } else if (event.type === 'tool_call' && event.phase === 'completed' && event.name && event.args) {
      calls.push({ id: event.callId, name: event.name, args: event.args as Record<string, any> })
    }
  }
  return { text, calls }
}

export async function chatOnce(settings: Settings, apiKey: string, messages: ChatMsg[]): Promise<string> {
  const { text } = await collectChat(settings, apiKey, messages)
  return text
}
