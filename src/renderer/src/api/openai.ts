import type { Settings } from '@/types'

export interface ChatMsg {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content?: string | null
  tool_calls?: any[]
  tool_call_id?: string
  name?: string
}

export interface ToolDef {
  type: 'function'
  function: {
    name: string
    description: string
    parameters: Record<string, any>
  }
}

export interface StreamEvent {
  type: 'delta' | 'tool_call' | 'done'
  content?: string
  toolCall?: { id: string; name: string; args: Record<string, any> }
}

// OpenAI 兼容 chat/completions，SSE 流式解析，同时累积文本与工具调用
export async function* streamChat(
  settings: Settings,
  apiKey: string,
  messages: ChatMsg[],
  tools?: ToolDef[],
  signal?: AbortSignal
): AsyncGenerator<StreamEvent> {
  const body: any = {
    model: settings.model,
    messages,
    stream: true
  }
  if (tools?.length) body.tools = tools

  const res = await fetch(`${settings.apiBaseUrl.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify(body),
    signal
  })

  if (!res.ok) {
    const err = await res.text().catch(() => '')
    throw new Error(`AI 请求失败 (${res.status}): ${err.slice(0, 300)}`)
  }

  const reader = res.body!.getReader()
  const decoder = new TextDecoder()
  const acc = new Map<number, { id?: string; name?: string; args: string }>()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed.startsWith('data:')) continue
      const data = trimmed.slice(5).trim()
      if (data === '[DONE]') continue
      let json: any
      try {
        json = JSON.parse(data)
      } catch {
        continue
      }
      const choice = json.choices?.[0]
      if (!choice) continue
      const delta = choice.delta || {}
      if (delta.content) yield { type: 'delta', content: delta.content }
      if (delta.tool_calls) {
        for (const tc of delta.tool_calls) {
          const cur = acc.get(tc.index) || { args: '' }
          if (tc.id) cur.id = tc.id
          if (tc.function?.name) cur.name = tc.function.name
          if (tc.function?.arguments) cur.args += tc.function.arguments
          acc.set(tc.index, cur)
        }
      }
    }
  }

  for (const [index, tc] of acc) {
    let args = {}
    try {
      args = JSON.parse(tc.args || '{}')
    } catch {
      args = { _raw: tc.args }
    }
    yield { type: 'tool_call', toolCall: { id: tc.id || `call_${index}`, name: tc.name || '', args } }
  }
  yield { type: 'done' }
}

// 消费一次流式请求，累积文本与工具调用；onDelta 用于实时回传推理内容
export async function collectChat(
  settings: Settings,
  apiKey: string,
  messages: ChatMsg[],
  tools?: ToolDef[],
  onDelta?: (d: string) => void,
  signal?: AbortSignal
): Promise<{ text: string; calls: NonNullable<StreamEvent['toolCall']>[] }> {
  let text = ''
  const calls = []
  for await (const ev of streamChat(settings, apiKey, messages, tools, signal)) {
    if (ev.type === 'delta') {
      text += ev.content || ''
      onDelta?.(ev.content || '')
    } else if (ev.type === 'tool_call' && ev.toolCall) {
      calls.push(ev.toolCall)
    }
  }
  return { text, calls }
}

// 一次性文本生成（不带工具），用于生成 commit message、AI 总结等
export async function chatOnce(settings: Settings, apiKey: string, messages: ChatMsg[]): Promise<string> {
  const { text } = await collectChat(settings, apiKey, messages)
  return text
}
