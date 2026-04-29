import { contextBridge, ipcRenderer } from 'electron'
import type { AgentSession, LaunchAgentInput, LocalAgent, LocalSkill, ProviderDetectionResult } from '../shared/types'

type ProviderSummary = {
  id: string
  displayName: string
  supports: Record<string, boolean>
}

type AgentOutputEvent = {
  sessionId: string
  chunk: string
}

const api = {
  providers: {
    list: () => ipcRenderer.invoke('providers:list') as Promise<ProviderSummary[]>,
    detect: () => ipcRenderer.invoke('providers:detect') as Promise<ProviderDetectionResult[]>,
  },
  agents: {
    listLocalClaude: () => ipcRenderer.invoke('agents:listLocalClaude') as Promise<LocalAgent[]>,
  },
  skills: {
    listLocalClaude: () => ipcRenderer.invoke('skills:listLocalClaude') as Promise<LocalSkill[]>,
  },
  workspaces: {
    chooseFolder: () => ipcRenderer.invoke('workspaces:chooseFolder') as Promise<string | undefined>,
  },
  sessions: {
    list: () => ipcRenderer.invoke('sessions:list') as Promise<AgentSession[]>,
    launch: (input: LaunchAgentInput) => ipcRenderer.invoke('sessions:launch', input) as Promise<AgentSession>,
    sendInput: (sessionId: string, input: string) => ipcRenderer.invoke('sessions:sendInput', { sessionId, input }) as Promise<void>,
    resize: (sessionId: string, cols: number, rows: number) => ipcRenderer.invoke('sessions:resize', { sessionId, cols, rows }) as Promise<void>,
    stop: (sessionId: string) => ipcRenderer.invoke('sessions:stop', { sessionId }) as Promise<void>,
    restart: (sessionId: string) => ipcRenderer.invoke('sessions:restart', { sessionId }) as Promise<AgentSession>,
    onOutput: (listener: (event: AgentOutputEvent) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, payload: AgentOutputEvent) => listener(payload)
      ipcRenderer.on('agent:output', handler)
      return () => ipcRenderer.off('agent:output', handler)
    },
    onStatus: (listener: (session: AgentSession) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, payload: AgentSession) => listener(payload)
      ipcRenderer.on('agent:status', handler)
      return () => ipcRenderer.off('agent:status', handler)
    },
  },
}

contextBridge.exposeInMainWorld('orchestrator', api)

export type OrchestratorApi = typeof api
