import { collectChat, type ChatMsg } from './openai'
import { TOOLS, SYSTEM, execTool } from './agent-tools'
import type { Settings } from '@/types'

export interface AgentEvent {
  type:
    | 'text'
    | 'tool_start'
    | 'tool_result'
    | 'final'
    | 'error'
    | 'done'
  content?: string
  toolCallId?: string
  toolName?: string
  toolArgs?: Record<string, any>
}

export async function runAgent(
  settingsStore: { settings: Settings },
  taskPrompt: string,
  workspace: string,
  onEvent: (ev: AgentEvent) => void,
  signal?: AbortSignal
) {
  const settings = settingsStore.settings
  const apiKey = (await window.api.settings.get()).aiKey
  const messages: ChatMsg[] = [
    { role: 'system', content: `${SYSTEM}\n当前工作区：${workspace}` },
    { role: 'user', content: taskPrompt }
  ]
  for (let i = 0; i < 12; i++) {
    const step = await collectChat(settings, apiKey, messages, TOOLS, (d) => onEvent({ type: 'text', content: d }), signal)
    if (!step.calls.length) {
      onEvent({ type: 'final', content: step.text })
      break
    }
    messages.push({
      role: 'assistant',
      content: step.text || null,
      tool_calls: step.calls.map((c) => ({ id: c.id, type: 'function', function: { name: c.name, arguments: JSON.stringify(c.args) } }))
    })
    for (const call of step.calls) {
      onEvent({ type: 'tool_start', toolCallId: call.id, toolName: call.name, toolArgs: call.args })
      let result
      try {
        result = await execTool(workspace, call.name, call.args)
      } catch (e) {
        result = `错误: ${(e as Error).message}`
      }
      onEvent({ type: 'tool_result', toolCallId: call.id, content: result })
      messages.push({ role: 'tool', tool_call_id: call.id, content: result })
    }
  }
  onEvent({ type: 'done' })
}
