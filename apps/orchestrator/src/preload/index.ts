import { contextBridge, ipcRenderer } from 'electron'
import type { AgentSession, CreateDevTerminalInput, DevTerminal, LaunchAgentInput, LocalAgent, LocalSkill, ProviderDetectionResult, SessionCompletionCounts } from '../shared/types'

type ProviderSummary = {
  id: string
  displayName: string
  supports: Record<string, boolean>
}

type AgentOutputEvent = {
  sessionId: string
  chunk: string
}

type DevTerminalOutputEvent = {
  terminalId: string
  chunk: string
}

const api = {
  providers: {
    list: () => ipcRenderer.invoke('providers:list') as Promise<ProviderSummary[]>,
    detect: () => ipcRenderer.invoke('providers:detect') as Promise<ProviderDetectionResult[]>,
  },
  agents: {
    listLocalClaude: () => ipcRenderer.invoke('agents:listLocalClaude') as Promise<LocalAgent[]>,
    listFromFolder: (folderPath: string) => ipcRenderer.invoke('agents:listFromFolder', folderPath) as Promise<LocalAgent[]>,
    chooseFolder: () => ipcRenderer.invoke('agents:chooseFolder') as Promise<string | undefined>,
  },
  skills: {
    listLocalClaude: () => ipcRenderer.invoke('skills:listLocalClaude') as Promise<LocalSkill[]>,
    listFromFolder: (folderPath: string) => ipcRenderer.invoke('skills:listFromFolder', folderPath) as Promise<LocalSkill[]>,
    chooseFolder: () => ipcRenderer.invoke('skills:chooseFolder') as Promise<string | undefined>,
  },
  workspaces: {
    chooseFolder: () => ipcRenderer.invoke('workspaces:chooseFolder') as Promise<string | undefined>,
    openInVSCode: (path: string) => ipcRenderer.invoke('workspaces:openInVSCode', { path }) as Promise<void>,
  },
  devTerminals: {
    list: () => ipcRenderer.invoke('devTerminals:list') as Promise<DevTerminal[]>,
    outputs: () => ipcRenderer.invoke('devTerminals:outputs') as Promise<Record<string, string>>,
    create: (input: CreateDevTerminalInput) => ipcRenderer.invoke('devTerminals:create', input) as Promise<DevTerminal>,
    sendInput: (terminalId: string, input: string) => ipcRenderer.invoke('devTerminals:sendInput', { terminalId, input }) as Promise<void>,
    resize: (terminalId: string, cols: number, rows: number) => ipcRenderer.invoke('devTerminals:resize', { terminalId, cols, rows }) as Promise<void>,
    stop: (terminalId: string) => ipcRenderer.invoke('devTerminals:stop', { terminalId }) as Promise<void>,
    remove: (terminalId: string) => ipcRenderer.invoke('devTerminals:remove', { terminalId }) as Promise<void>,
    rename: (terminalId: string, name: string) => ipcRenderer.invoke('devTerminals:rename', { terminalId, name }) as Promise<DevTerminal>,
    onOutput: (listener: (event: DevTerminalOutputEvent) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, payload: DevTerminalOutputEvent) => listener(payload)
      ipcRenderer.on('devTerminal:output', handler)
      return () => ipcRenderer.off('devTerminal:output', handler)
    },
    onStatus: (listener: (terminal: DevTerminal) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, payload: DevTerminal) => listener(payload)
      ipcRenderer.on('devTerminal:status', handler)
      return () => ipcRenderer.off('devTerminal:status', handler)
    },
  },
  sessions: {
    list: () => ipcRenderer.invoke('sessions:list') as Promise<AgentSession[]>,
    outputs: () => ipcRenderer.invoke('sessions:outputs') as Promise<Record<string, string>>,
    completionCounts: () => ipcRenderer.invoke('sessions:completionCounts') as Promise<SessionCompletionCounts>,
    clearCompletionCounts: (sessionIds: string[]) => ipcRenderer.invoke('sessions:clearCompletionCounts', sessionIds) as Promise<SessionCompletionCounts>,
    launch: (input: LaunchAgentInput) => ipcRenderer.invoke('sessions:launch', input) as Promise<AgentSession>,
    sendInput: (sessionId: string, input: string) => ipcRenderer.invoke('sessions:sendInput', { sessionId, input }) as Promise<void>,
    resize: (sessionId: string, cols: number, rows: number) => ipcRenderer.invoke('sessions:resize', { sessionId, cols, rows }) as Promise<void>,
    stop: (sessionId: string) => ipcRenderer.invoke('sessions:stop', { sessionId }) as Promise<void>,
    restart: (sessionId: string) => ipcRenderer.invoke('sessions:restart', { sessionId }) as Promise<AgentSession>,
    rename: (sessionId: string, name: string) => ipcRenderer.invoke('sessions:rename', { sessionId, name }) as Promise<AgentSession>,
    remove: (sessionId: string) => ipcRenderer.invoke('sessions:remove', { sessionId }) as Promise<void>,
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
