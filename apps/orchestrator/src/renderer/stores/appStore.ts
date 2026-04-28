import { create } from 'zustand'
import type { AgentSession, LocalAgent, LocalSkill, ProviderDetectionResult } from '../../shared/types'

export type TerminalSplitOrientation = 'horizontal' | 'vertical'

export type TerminalLayoutNode =
  | {
      type: 'pane'
      id: string
      sessionIds: string[]
      activeSessionId?: string
    }
  | {
      type: 'split'
      id: string
      orientation: TerminalSplitOrientation
      children: TerminalLayoutNode[]
    }

type AppState = {
  sessions: AgentSession[]
  activeSessionId?: string
  outputBySession: Record<string, string>
  detections: ProviderDetectionResult[]
  localAgents: LocalAgent[]
  localSkills: LocalSkill[]
  terminalLayout: TerminalLayoutNode
  activePaneId: string
  setSessions: (sessions: AgentSession[]) => void
  upsertSession: (session: AgentSession) => void
  setActiveSessionId: (sessionId: string | undefined) => void
  appendOutput: (sessionId: string, chunk: string) => void
  setDetections: (detections: ProviderDetectionResult[]) => void
  setLocalAgents: (agents: LocalAgent[]) => void
  setLocalSkills: (skills: LocalSkill[]) => void
  setActivePane: (paneId: string) => void
  selectPaneSession: (paneId: string, sessionId: string) => void
  addSessionToActivePane: (sessionId: string) => void
  splitPane: (paneId: string, orientation: TerminalSplitOrientation) => void
  moveSessionToPane: (sessionId: string, targetPaneId: string) => void
  removeSessionFromLayout: (sessionId: string) => void
}

const initialPaneId = 'pane-root'
const initialLayout: TerminalLayoutNode = {
  type: 'pane',
  id: initialPaneId,
  sessionIds: [],
}

export const useAppStore = create<AppState>(set => ({
  sessions: [],
  outputBySession: {},
  detections: [],
  localAgents: [],
  localSkills: [],
  terminalLayout: initialLayout,
  activePaneId: initialPaneId,
  setSessions: sessions => set(state => ({
    sessions,
    terminalLayout: repairLayout(state.terminalLayout, sessions.map(session => session.id)),
  })),
  upsertSession: session => set(state => {
    const sessions = state.sessions.some(current => current.id === session.id)
      ? state.sessions.map(current => current.id === session.id ? session : current)
      : [...state.sessions, session]
    return {
      sessions,
      activeSessionId: state.activeSessionId ?? session.id,
    }
  }),
  setActiveSessionId: activeSessionId => set({ activeSessionId }),
  appendOutput: (sessionId, chunk) => set(state => ({
    outputBySession: {
      ...state.outputBySession,
      [sessionId]: `${state.outputBySession[sessionId] ?? ''}${chunk}`,
    },
  })),
  setDetections: detections => set({ detections }),
  setLocalAgents: localAgents => set({ localAgents }),
  setLocalSkills: localSkills => set({ localSkills }),
  setActivePane: activePaneId => set({ activePaneId }),
  selectPaneSession: (paneId, sessionId) => set(state => ({
    terminalLayout: updatePane(state.terminalLayout, paneId, pane => ({
      ...pane,
      activeSessionId: sessionId,
    })),
    activePaneId: paneId,
    activeSessionId: sessionId,
  })),
  addSessionToActivePane: sessionId => set(state => ({
    terminalLayout: removeSessionFromLayout(
      updatePane(state.terminalLayout, state.activePaneId, pane => ({
        ...pane,
        sessionIds: pane.sessionIds.includes(sessionId) ? pane.sessionIds : [...pane.sessionIds, sessionId],
        activeSessionId: sessionId,
      })),
      sessionId,
      state.activePaneId,
    ),
    activeSessionId: sessionId,
  })),
  splitPane: (paneId, orientation) => set(state => {
    const newPaneId = `pane-${crypto.randomUUID()}`
    return {
      terminalLayout: splitPaneNode(state.terminalLayout, paneId, orientation, newPaneId),
      activePaneId: newPaneId,
    }
  }),
  moveSessionToPane: (sessionId, targetPaneId) => set(state => ({
    terminalLayout: updatePane(
      removeSessionFromLayout(state.terminalLayout, sessionId, targetPaneId),
      targetPaneId,
      pane => ({
        ...pane,
        sessionIds: pane.sessionIds.includes(sessionId) ? pane.sessionIds : [...pane.sessionIds, sessionId],
        activeSessionId: sessionId,
      }),
    ),
    activePaneId: targetPaneId,
    activeSessionId: sessionId,
  })),
  removeSessionFromLayout: sessionId => set(state => ({
    terminalLayout: removeSessionFromLayout(state.terminalLayout, sessionId),
    activeSessionId: state.activeSessionId === sessionId ? undefined : state.activeSessionId,
  })),
}))

type PaneNode = Extract<TerminalLayoutNode, { type: 'pane' }>

function updatePane(node: TerminalLayoutNode, paneId: string, updater: (pane: PaneNode) => PaneNode): TerminalLayoutNode {
  if (node.type === 'pane') {
    return node.id === paneId ? updater(node) : node
  }
  return {
    ...node,
    children: node.children.map(child => updatePane(child, paneId, updater)),
  }
}

function splitPaneNode(
  node: TerminalLayoutNode,
  paneId: string,
  orientation: TerminalSplitOrientation,
  newPaneId: string,
): TerminalLayoutNode {
  if (node.type === 'pane') {
    if (node.id !== paneId) return node
    return {
      type: 'split',
      id: `split-${crypto.randomUUID()}`,
      orientation,
      children: [
        node,
        {
          type: 'pane',
          id: newPaneId,
          sessionIds: [],
        },
      ],
    }
  }
  return {
    ...node,
    children: node.children.map(child => splitPaneNode(child, paneId, orientation, newPaneId)),
  }
}

function removeSessionFromLayout(node: TerminalLayoutNode, sessionId: string, exceptPaneId?: string): TerminalLayoutNode {
  if (node.type === 'pane') {
    if (node.id === exceptPaneId) return node
    const sessionIds = node.sessionIds.filter(id => id !== sessionId)
    return {
      ...node,
      sessionIds,
      activeSessionId: node.activeSessionId === sessionId ? sessionIds[0] : node.activeSessionId,
    }
  }
  return {
    ...node,
    children: node.children.map(child => removeSessionFromLayout(child, sessionId, exceptPaneId)),
  }
}

function repairLayout(node: TerminalLayoutNode, validSessionIds: string[]): TerminalLayoutNode {
  const valid = new Set(validSessionIds)
  if (node.type === 'pane') {
    const sessionIds = node.sessionIds.filter(id => valid.has(id))
    return {
      ...node,
      sessionIds,
      activeSessionId: node.activeSessionId && valid.has(node.activeSessionId) ? node.activeSessionId : sessionIds[0],
    }
  }
  return {
    ...node,
    children: node.children.map(child => repairLayout(child, validSessionIds)),
  }
}
