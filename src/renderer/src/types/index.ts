export interface Settings {
  apiBaseUrl: string
  model: string
  embeddingModel: string
}

export type Role = 'user' | 'assistant'

export type StreamState = 'streaming' | 'completed' | 'aborted' | 'failed'
export type ToolCallStatus = 'running' | 'succeeded' | 'failed'

export interface StreamUsage {
  prompt_tokens?: number
  completion_tokens?: number
  total_tokens?: number
  [key: string]: unknown
}

interface TurnEventBase {
  seq: number
  timestamp: number
}

export interface AssistantTextEvent extends TurnEventBase {
  type: 'assistant_text'
  text: string
}

export interface ReasoningEvent extends TurnEventBase {
  type: 'reasoning'
  text: string
}

export interface ToolCallEvent extends TurnEventBase {
  type: 'tool_call'
  callId: string
  providerCallId?: string
  index: number
  phase: 'started' | 'arguments' | 'completed'
  name?: string
  argsFragment?: string
  rawArgs: string
  args?: Record<string, unknown>
  error?: string
}

export interface ToolResultEvent extends TurnEventBase {
  type: 'tool_result'
  callId: string
  providerCallId?: string
  name: string
  status: ToolCallStatus
  content?: string
  error?: string
}

export interface StreamStatusEvent extends TurnEventBase {
  type: 'status'
  state: StreamState
  finishReason?: string | null
  usage?: StreamUsage
  error?: string
}

export interface StreamErrorEvent extends TurnEventBase {
  type: 'error'
  error: string
}

// One durable, ordered record of everything that happened in an assistant turn.
export type AssistantTurnEvent =
  | AssistantTextEvent
  | ReasoningEvent
  | ToolCallEvent
  | ToolResultEvent
  | StreamStatusEvent
  | StreamErrorEvent

type WithoutTurnMetadata<T> = T extends TurnEventBase ? Omit<T, 'seq' | 'timestamp'> : never
export type AssistantTurnEventInput = WithoutTurnMetadata<AssistantTurnEvent>

// Kept for the existing renderer store and tool-call display. New streaming code uses AssistantTurnEvent.
export interface ToolCall {
  id: string
  name: string
  args: Record<string, any>
  status: 'running' | 'done' | 'error'
  result?: string
}

export interface Message {
  id: string
  role: Role
  content: string
  events?: AssistantTurnEvent[]
  toolCalls?: ToolCall[]
  createdAt: number
}

export interface ProviderHistoryToolCall {
  id: string
  type: 'function'
  function: { name: string; arguments: string }
}

export interface ProviderHistoryMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content?: string | null
  tool_calls?: ProviderHistoryToolCall[]
  tool_call_id?: string
  name?: string
  reasoning_content?: string
}

export interface Conversation {
  id: string
  title: string
  messages: Message[]
  workspace?: string
  protocolHistory?: ProviderHistoryMessage[]
  createdAt: number
  updatedAt?: number
}

export interface Repo {
  id: number
  name: string
  full_name: string
  html_url: string
  description: string | null
  language: string | null
  stargazers_count: number
  default_branch: string
}

export interface PullRequest {
  number: number
  title: string
  state: string
  user?: { login: string }
  created_at: string
  body?: string | null
}

export interface Issue {
  number: number
  title: string
  state: string
  user?: { login: string }
  created_at: string
  body?: string | null
}

export interface Commit {
  sha: string
  commit: { message: string; author: { name: string; date: string } }
}

export interface SearchHit {
  file: string
  score: number
  snippet: string
}
