export type ComposerMode = 'coding' | 'thinking' | 'security'
export type ReasoningEffort = 'low' | 'medium' | 'high' | 'xhigh'
export type ApprovalMode = 'request' | 'help' | 'full'

export interface ModeModelPreset {
  model?: string
  temperature?: number
  reasoningEffort?: ReasoningEffort
}

export interface RequestCapabilities {
  temperature?: boolean
  reasoningEffort?: boolean
}
export interface ComposerAttachment {
  id: string
  name: string
  kind: 'image' | 'text' | 'file'
  mime: string
  size: number
  data?: string
  content?: string
}

export interface Settings {
  apiBaseUrl: string
  model: string
  models?: string[]
  modePresets?: Partial<Record<ComposerMode, ModeModelPreset>>
  requestCapabilities?: RequestCapabilities
  approvalMode?: ApprovalMode
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

export interface FileEditPreview {
  path: string
  // Real state read before the write; proposedContent is never a committed after snapshot.
  before: { state: 'present' | 'missing' | 'unknown'; content: string | null; error?: string }
  proposedContent: string
  operation: 'modify' | 'create' | 'unknown'
}

// Retained for existing write-file callers.
export type WriteFilePreview = FileEditPreview

export interface ToolCallEvent extends TurnEventBase {
  type: 'tool_call'
  // Internal ID is unique across the entire run and joins tool events/change records.
  callId: string
  // Original provider ID, retained for the protocol's tool messages.
  providerCallId?: string
  index: number
  phase: 'started' | 'arguments' | 'completed'
  name?: string
  argsFragment?: string
  rawArgs: string
  args?: Record<string, unknown>
  error?: string
  fileEditPreview?: FileEditPreview
  // Deprecated event property retained for persisted turns created before fileEditPreview.
  writePreview?: WriteFilePreview
}

export interface ToolResultEvent extends TurnEventBase {
  type: 'tool_result'
  callId: string
  providerCallId?: string
  name: string
  status: ToolCallStatus
  content?: string
  liveOutput?: string
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
  protocolUserIndex?: number
  turnId?: string
  attachments?: ComposerAttachment[]
  createdAt: number
}

export interface ProviderHistoryToolCall {
  id: string
  type: 'function'
  function: { name: string; arguments: string }
}

export interface ProviderHistoryMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content?: string | import('@/api/openai').ChatContentPart[] | null
  tool_calls?: ProviderHistoryToolCall[]
  tool_call_id?: string
  name?: string
  reasoning_content?: string
}

export interface Project {
  id: string
  name: string
  workspace: string
  createdAt: number
  updatedAt: number
  archivedAt?: number
}

export interface Conversation {
  id: string
  title: string
  messages: Message[]
  workspace?: string
  projectId?: string
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

export interface SkillSummary {
  name: string
  description: string
  path: string
  scope?: 'personal' | 'system' | string
  icon?: string
}

export interface SkillDetail extends SkillSummary {
  content: string
  truncated: boolean
}

export interface ComposerAddAction {
  key: string
  label: string
  description?: string
  icon: string
}

export interface ComposerPluginItem {
  key: string
  name: string
  description: string
  icon: string
  iconBg?: string
  iconColor?: string
}

export interface DiffFileBrief {
  path: string
  before?: string | null
  after?: string | null
  additions?: number
  deletions?: number
  // legacy compat: when before/after not supplied, lines/content fallback is used
  lines?: Array<{ num: number; text: string; type?: 'add' | 'del' | 'context' }>
  content?: string
}
