import type { SuperAgentApi } from './index'

declare global {
  interface Window {
    api: SuperAgentApi
  }
}

export {}
