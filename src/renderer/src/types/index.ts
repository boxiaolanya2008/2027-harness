export interface Settings {
  apiBaseUrl: string
  model: string
  embeddingModel: string
}

export type Role = 'user' | 'assistant'

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
  toolCalls?: ToolCall[]
  createdAt: number
}

export interface Conversation {
  id: string
  title: string
  messages: Message[]
  workspace?: string
  createdAt: number
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
