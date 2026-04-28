/// <reference types="vite/client" />

import type { OrchestratorApi } from '../../preload'

declare global {
  interface Window {
    orchestrator: OrchestratorApi
  }
}
