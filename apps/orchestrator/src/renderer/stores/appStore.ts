import { create } from 'zustand'
import type { AgentSession, LocalAgent, LocalSkill, ProviderDetectionResult, Workspace, WorkspaceMode } from '../../shared/types'

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
      sizes?: number[]
    }

type PersistedWorkspaceState = {
  workspaces: Workspace[]
  activeWorkspaceId?: string
  layoutByWorkspaceId: Record<string, TerminalLayoutNode>
  activePaneIdByWorkspaceId: Record<string, string>
  activeSessionIdByWorkspaceId: Record<string, string | undefined>
  previewUrlByWorkspaceId: Record<string, string | undefined>
  previewPanelWidthByWorkspaceId: Record<string, number | undefined>
  previewPanelHiddenByWorkspaceId: Record<string, boolean | undefined>
}

type AppState = {
  workspaces: Workspace[]
  activeWorkspaceId?: string
  sessions: AgentSession[]
  activeSessionId?: string
  outputBySession: Record<string, string>
  detections: ProviderDetectionResult[]
  localAgents: LocalAgent[]
  localSkills: LocalSkill[]
  terminalLayout: TerminalLayoutNode
  activePaneId: string
  layoutByWorkspaceId: Record<string, TerminalLayoutNode>
  activePaneIdByWorkspaceId: Record<string, string>
  activeSessionIdByWorkspaceId: Record<string, string | undefined>
  previewUrlByWorkspaceId: Record<string, string | undefined>
  previewPanelWidthByWorkspaceId: Record<string, number | undefined>
  previewPanelHiddenByWorkspaceId: Record<string, boolean | undefined>
  addWorkspace: (path: string) => Workspace
  setActiveWorkspace: (workspaceId: string) => void
  updateWorkspace: (workspaceId: string, input: Partial<Pick<Workspace, 'name' | 'defaultWorkspaceMode'>>) => void
  removeWorkspace: (workspaceId: string) => void
  setSessions: (sessions: AgentSession[]) => void
  upsertSession: (session: AgentSession) => void
  setActiveSessionId: (sessionId: string | undefined) => void
  setOutputBySession: (outputBySession: Record<string, string>) => void
  appendOutput: (sessionId: string, chunk: string) => void
  setDetections: (detections: ProviderDetectionResult[]) => void
  setLocalAgents: (agents: LocalAgent[]) => void
  setLocalSkills: (skills: LocalSkill[]) => void
  setActivePane: (paneId: string) => void
  selectPaneSession: (paneId: string, sessionId: string) => void
  addSessionToActivePane: (sessionId: string) => void
  splitPane: (paneId: string, orientation: TerminalSplitOrientation) => void
  resizeSplit: (splitId: string, sizes: number[]) => void
  moveSessionToPane: (sessionId: string, targetPaneId: string) => void
  removeSessionFromLayout: (sessionId: string) => void
  closePane: (paneId: string) => void
  renameSession: (sessionId: string, name: string) => void
  setWorkspacePreviewUrl: (workspaceId: string, url: string) => void
  setWorkspacePreviewPanelWidth: (workspaceId: string, width: number) => void
  setWorkspacePreviewPanelHidden: (workspaceId: string, hidden: boolean) => void
}

const STORAGE_KEY = 'codex3d-orchestrator-workspaces'
const initialPaneId = 'pane-root'
const initialLayout: TerminalLayoutNode = {
  type: 'pane',
  id: initialPaneId,
  sessionIds: [],
}

const persisted = loadPersistedState()

export const useAppStore = create<AppState>((set, get) => ({
  workspaces: persisted.workspaces,
  activeWorkspaceId: persisted.activeWorkspaceId ?? persisted.workspaces[0]?.id,
  sessions: [],
  outputBySession: {},
  detections: [],
  localAgents: [],
  localSkills: [],
  layoutByWorkspaceId: persisted.layoutByWorkspaceId,
  activePaneIdByWorkspaceId: persisted.activePaneIdByWorkspaceId,
  activeSessionIdByWorkspaceId: persisted.activeSessionIdByWorkspaceId,
  previewUrlByWorkspaceId: persisted.previewUrlByWorkspaceId,
  previewPanelWidthByWorkspaceId: persisted.previewPanelWidthByWorkspaceId,
  previewPanelHiddenByWorkspaceId: persisted.previewPanelHiddenByWorkspaceId,
  terminalLayout: getWorkspaceLayout(persisted.activeWorkspaceId ?? persisted.workspaces[0]?.id, persisted.layoutByWorkspaceId),
  activePaneId: getWorkspaceActivePaneId(persisted.activeWorkspaceId ?? persisted.workspaces[0]?.id, persisted.activePaneIdByWorkspaceId),
  addWorkspace: path => {
    const now = Date.now()
    const workspace: Workspace = {
      id: `workspace-${crypto.randomUUID()}`,
      name: workspaceNameFromPath(path),
      path,
      defaultWorkspaceMode: 'same-folder',
      createdAt: now,
      updatedAt: now,
    }
    set(state => {
      const workspaces = [...state.workspaces, workspace]
      const layoutByWorkspaceId = {
        ...state.layoutByWorkspaceId,
        [workspace.id]: cloneInitialLayout(),
      }
      const activePaneIdByWorkspaceId = {
        ...state.activePaneIdByWorkspaceId,
        [workspace.id]: initialPaneId,
      }
      const next = {
        workspaces,
        activeWorkspaceId: workspace.id,
        layoutByWorkspaceId,
        activePaneIdByWorkspaceId,
        activeSessionIdByWorkspaceId: state.activeSessionIdByWorkspaceId,
        previewUrlByWorkspaceId: state.previewUrlByWorkspaceId,
        previewPanelWidthByWorkspaceId: state.previewPanelWidthByWorkspaceId,
        previewPanelHiddenByWorkspaceId: state.previewPanelHiddenByWorkspaceId,
        terminalLayout: layoutByWorkspaceId[workspace.id],
        activePaneId: initialPaneId,
        activeSessionId: undefined,
      }
      persistWorkspaceState(next)
      return next
    })
    return workspace
  },
  setActiveWorkspace: workspaceId => set(state => {
    const terminalLayout = getWorkspaceLayout(workspaceId, state.layoutByWorkspaceId)
    const activePaneId = getWorkspaceActivePaneId(workspaceId, state.activePaneIdByWorkspaceId)
    const activeSessionId = state.activeSessionIdByWorkspaceId[workspaceId]
    const next = {
      activeWorkspaceId: workspaceId,
      terminalLayout,
      activePaneId,
      activeSessionId,
    }
    persistWorkspaceState({ ...state, ...next })
    return next
  }),
  updateWorkspace: (workspaceId, input) => set(state => {
    const workspaces = state.workspaces.map(workspace => workspace.id === workspaceId
      ? { ...workspace, ...input, updatedAt: Date.now() }
      : workspace)
    const next = { workspaces }
    persistWorkspaceState({ ...state, ...next })
    return next
  }),
  removeWorkspace: workspaceId => set(state => {
    const workspaces = state.workspaces.filter(workspace => workspace.id !== workspaceId)
    const activeWorkspaceId = state.activeWorkspaceId === workspaceId ? workspaces[0]?.id : state.activeWorkspaceId
    const { [workspaceId]: _removedLayout, ...layoutByWorkspaceId } = state.layoutByWorkspaceId
    const { [workspaceId]: _removedPane, ...activePaneIdByWorkspaceId } = state.activePaneIdByWorkspaceId
    const { [workspaceId]: _removedSession, ...activeSessionIdByWorkspaceId } = state.activeSessionIdByWorkspaceId
    const { [workspaceId]: _removedPreviewUrl, ...previewUrlByWorkspaceId } = state.previewUrlByWorkspaceId
    const { [workspaceId]: _removedPreviewPanelWidth, ...previewPanelWidthByWorkspaceId } = state.previewPanelWidthByWorkspaceId
    const { [workspaceId]: _removedPreviewPanelHidden, ...previewPanelHiddenByWorkspaceId } = state.previewPanelHiddenByWorkspaceId
    const terminalLayout = getWorkspaceLayout(activeWorkspaceId, layoutByWorkspaceId)
    const activePaneId = getWorkspaceActivePaneId(activeWorkspaceId, activePaneIdByWorkspaceId)
    const activeSessionId = activeWorkspaceId ? activeSessionIdByWorkspaceId[activeWorkspaceId] : undefined
    const next = {
      workspaces,
      activeWorkspaceId,
      layoutByWorkspaceId,
      activePaneIdByWorkspaceId,
      activeSessionIdByWorkspaceId,
      previewUrlByWorkspaceId,
      previewPanelWidthByWorkspaceId,
      previewPanelHiddenByWorkspaceId,
      terminalLayout,
      activePaneId,
      activeSessionId,
    }
    persistWorkspaceState({ ...state, ...next })
    return next
  }),
  setSessions: sessions => set(state => {
    const layoutByWorkspaceId = repairAllWorkspaceLayouts(state.layoutByWorkspaceId, sessions, state.workspaces.map(workspace => workspace.id))
    const activeWorkspaceId = state.activeWorkspaceId
    const terminalLayout = getWorkspaceLayout(activeWorkspaceId, layoutByWorkspaceId)
    const activeSessionIdByWorkspaceId = repairActiveSessions(state.activeSessionIdByWorkspaceId, layoutByWorkspaceId)
    const activeSessionId = activeWorkspaceId ? activeSessionIdByWorkspaceId[activeWorkspaceId] : undefined
    const next = {
      sessions,
      layoutByWorkspaceId,
      activeSessionIdByWorkspaceId,
      terminalLayout,
      activeSessionId,
    }
    persistWorkspaceState({ ...state, ...next })
    return next
  }),
  upsertSession: session => set(state => {
    const sessions = state.sessions.some(current => current.id === session.id)
      ? state.sessions.map(current => current.id === session.id ? session : current)
      : [...state.sessions, session]
    return {
      sessions,
      activeSessionId: state.activeSessionId ?? session.id,
    }
  }),
  setActiveSessionId: activeSessionId => set(state => {
    const activeSessionIdByWorkspaceId = state.activeWorkspaceId
      ? { ...state.activeSessionIdByWorkspaceId, [state.activeWorkspaceId]: activeSessionId }
      : state.activeSessionIdByWorkspaceId
    const next = { activeSessionId, activeSessionIdByWorkspaceId }
    persistWorkspaceState({ ...state, ...next })
    return next
  }),
  setOutputBySession: outputBySession => set({ outputBySession }),
  appendOutput: (sessionId, chunk) => set(state => ({
    outputBySession: {
      ...state.outputBySession,
      [sessionId]: `${state.outputBySession[sessionId] ?? ''}${chunk}`,
    },
  })),
  setDetections: detections => set({ detections }),
  setLocalAgents: localAgents => set({ localAgents }),
  setLocalSkills: localSkills => set({ localSkills }),
  setActivePane: activePaneId => set(state => {
    const activePaneIdByWorkspaceId = state.activeWorkspaceId
      ? { ...state.activePaneIdByWorkspaceId, [state.activeWorkspaceId]: activePaneId }
      : state.activePaneIdByWorkspaceId
    const next = { activePaneId, activePaneIdByWorkspaceId }
    persistWorkspaceState({ ...state, ...next })
    return next
  }),
  selectPaneSession: (paneId, sessionId) => set(state => applyWorkspaceLayoutUpdate(state, layout => updatePane(layout, paneId, pane => ({
    ...pane,
    activeSessionId: sessionId,
  })), {
    activePaneId: paneId,
    activeSessionId: sessionId,
  })),
  addSessionToActivePane: sessionId => set(state => applyWorkspaceLayoutUpdate(state, (layout, activePaneId) => removeSessionFromLayout(
    updatePane(layout, activePaneId, pane => ({
      ...pane,
      sessionIds: pane.sessionIds.includes(sessionId) ? pane.sessionIds : [...pane.sessionIds, sessionId],
      activeSessionId: sessionId,
    })),
    sessionId,
    activePaneId,
  ), { activeSessionId: sessionId })),
  splitPane: (paneId, orientation) => set(state => {
    const newPaneId = `pane-${crypto.randomUUID()}`
    return applyWorkspaceLayoutUpdate(state, layout => splitPaneNode(layout, paneId, orientation, newPaneId), {
      activePaneId: newPaneId,
    })
  }),
  resizeSplit: (splitId, sizes) => set(state => applyWorkspaceLayoutUpdate(state, layout => resizeSplitNode(layout, splitId, sizes), {})),
  moveSessionToPane: (sessionId, targetPaneId) => set(state => applyWorkspaceLayoutUpdate(state, layout => updatePane(
    removeSessionFromLayout(layout, sessionId, targetPaneId),
    targetPaneId,
    pane => ({
      ...pane,
      sessionIds: pane.sessionIds.includes(sessionId) ? pane.sessionIds : [...pane.sessionIds, sessionId],
      activeSessionId: sessionId,
    }),
  ), {
    activePaneId: targetPaneId,
    activeSessionId: sessionId,
  })),
  removeSessionFromLayout: sessionId => set(state => {
    const owningWorkspaceId = state.sessions.find(session => session.id === sessionId)?.workspaceId ?? state.activeWorkspaceId
    if (!owningWorkspaceId) return {}

    const updatedLayout = removeSessionFromLayout(getWorkspaceLayout(owningWorkspaceId, state.layoutByWorkspaceId), sessionId)
    const layoutByWorkspaceId = { ...state.layoutByWorkspaceId, [owningWorkspaceId]: updatedLayout }
    const activeSessionIdByWorkspaceId = {
      ...state.activeSessionIdByWorkspaceId,
      [owningWorkspaceId]: state.activeSessionIdByWorkspaceId[owningWorkspaceId] === sessionId
        ? firstSessionInLayout(updatedLayout)
        : state.activeSessionIdByWorkspaceId[owningWorkspaceId],
    }
    const isActiveWorkspace = owningWorkspaceId === state.activeWorkspaceId
    const next = {
      layoutByWorkspaceId,
      activeSessionIdByWorkspaceId,
      terminalLayout: isActiveWorkspace ? updatedLayout : state.terminalLayout,
      activeSessionId: isActiveWorkspace ? activeSessionIdByWorkspaceId[owningWorkspaceId] : state.activeSessionId,
    }
    persistWorkspaceState({ ...state, ...next })
    return next
  }),
  closePane: paneId => set(state => applyWorkspaceLayoutUpdate(state, layout => closePaneNode(layout, paneId), {})),
  renameSession: (sessionId, name) => set(state => ({
    sessions: state.sessions.map(session => session.id === sessionId ? { ...session, name, updatedAt: Date.now() } : session),
  })),
  setWorkspacePreviewUrl: (workspaceId, url) => set(state => {
    const previewUrlByWorkspaceId = {
      ...state.previewUrlByWorkspaceId,
      [workspaceId]: normalizePreviewUrl(url),
    }
    const next = { previewUrlByWorkspaceId }
    persistWorkspaceState({ ...state, ...next })
    return next
  }),
  setWorkspacePreviewPanelWidth: (workspaceId, width) => set(state => {
    const previewPanelWidthByWorkspaceId = {
      ...state.previewPanelWidthByWorkspaceId,
      [workspaceId]: Math.round(Math.min(760, Math.max(280, width))),
    }
    const next = { previewPanelWidthByWorkspaceId }
    persistWorkspaceState({ ...state, ...next })
    return next
  }),
  setWorkspacePreviewPanelHidden: (workspaceId, hidden) => set(state => {
    const previewPanelHiddenByWorkspaceId = {
      ...state.previewPanelHiddenByWorkspaceId,
      [workspaceId]: hidden,
    }
    const next = { previewPanelHiddenByWorkspaceId }
    persistWorkspaceState({ ...state, ...next })
    return next
  }),
}))

type PaneNode = Extract<TerminalLayoutNode, { type: 'pane' }>

function applyWorkspaceLayoutUpdate(
  state: AppState,
  updater: (layout: TerminalLayoutNode, activePaneId: string) => TerminalLayoutNode,
  partial: Partial<Pick<AppState, 'activePaneId' | 'activeSessionId'>> = {},
): Partial<AppState> {
  const workspaceId = state.activeWorkspaceId
  if (!workspaceId) return {}
  const currentLayout = getWorkspaceLayout(workspaceId, state.layoutByWorkspaceId)
  const requestedPaneId = partial.activePaneId ?? state.activePaneId
  const safeActivePaneId = hasPane(currentLayout, requestedPaneId) ? requestedPaneId : firstPaneId(currentLayout)
  const terminalLayout = updater(currentLayout, safeActivePaneId)
  const activePaneId = hasPane(terminalLayout, safeActivePaneId) ? safeActivePaneId : firstPaneId(terminalLayout)
  const activeSessionId = partial.activeSessionId ?? state.activeSessionId
  const layoutByWorkspaceId = { ...state.layoutByWorkspaceId, [workspaceId]: terminalLayout }
  const activePaneIdByWorkspaceId = { ...state.activePaneIdByWorkspaceId, [workspaceId]: activePaneId }
  const activeSessionIdByWorkspaceId = { ...state.activeSessionIdByWorkspaceId, [workspaceId]: activeSessionId }
  const next = {
    terminalLayout,
    activePaneId,
    activeSessionId,
    layoutByWorkspaceId,
    activePaneIdByWorkspaceId,
    activeSessionIdByWorkspaceId,
  }
  persistWorkspaceState({ ...state, ...next })
  return next
}

function updatePane(node: TerminalLayoutNode, paneId: string, updater: (pane: PaneNode) => PaneNode): TerminalLayoutNode {
  if (node.type === 'pane') {
    return node.id === paneId ? updater(node) : node
  }
  return {
    ...node,
    children: node.children.map(child => updatePane(child, paneId, updater)),
  }
}

function closePaneNode(node: TerminalLayoutNode, paneId: string): TerminalLayoutNode {
  if (node.type === 'pane') return node

  const children = node.children
    .filter(child => child.type !== 'pane' || child.id !== paneId)
    .map(child => closePaneNode(child, paneId))

  if (children.length === 0) return cloneInitialLayout()
  if (children.length === 1) return children[0]
  return { ...node, children }
}

function hasPane(node: TerminalLayoutNode, paneId: string): boolean {
  if (node.type === 'pane') return node.id === paneId
  return node.children.some(child => hasPane(child, paneId))
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
      sizes: [50, 50],
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

function resizeSplitNode(node: TerminalLayoutNode, splitId: string, sizes: number[]): TerminalLayoutNode {
  if (node.type === 'pane') return node
  if (node.id === splitId) {
    return {
      ...node,
      sizes: normalizeSplitSizes(sizes, node.children.length),
    }
  }
  return {
    ...node,
    children: node.children.map(child => resizeSplitNode(child, splitId, sizes)),
  }
}

function normalizeSplitSizes(sizes: number[] | undefined, childCount: number): number[] {
  if (!childCount) return []
  const fallback = 100 / childCount
  const next = Array.from({ length: childCount }, (_, index) => Math.max(1, sizes?.[index] ?? fallback))
  const total = next.reduce((sum, size) => sum + size, 0)
  return next.map(size => (size / total) * 100)
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

function attachMissingSessions(layout: TerminalLayoutNode, validSessionIds: string[]): TerminalLayoutNode {
  const existing = new Set(collectSessionIds(layout))
  const missing = validSessionIds.filter(sessionId => !existing.has(sessionId))
  if (missing.length === 0) return layout

  return updateFirstPane(layout, pane => ({
    ...pane,
    sessionIds: [...pane.sessionIds, ...missing],
    activeSessionId: pane.activeSessionId ?? missing[0],
  }))
}

function firstPaneId(node: TerminalLayoutNode): string {
  if (node.type === 'pane') return node.id
  return firstPaneId(node.children[0])
}

function updateFirstPane(node: TerminalLayoutNode, updater: (pane: PaneNode) => PaneNode): TerminalLayoutNode {
  if (node.type === 'pane') return updater(node)
  const [first, ...rest] = node.children
  return {
    ...node,
    children: [updateFirstPane(first, updater), ...rest],
  }
}

function collectSessionIds(node: TerminalLayoutNode): string[] {
  if (node.type === 'pane') return node.sessionIds
  return node.children.flatMap(collectSessionIds)
}

function firstSessionInLayout(node: TerminalLayoutNode): string | undefined {
  return collectSessionIds(node)[0]
}

function repairActiveSessions(
  activeSessionIdByWorkspaceId: Record<string, string | undefined>,
  layoutByWorkspaceId: Record<string, TerminalLayoutNode>,
): Record<string, string | undefined> {
  return Object.fromEntries(
    Object.entries(layoutByWorkspaceId).map(([workspaceId, layout]) => {
      const sessionIds = collectSessionIds(layout)
      const activeSessionId = activeSessionIdByWorkspaceId[workspaceId]
      return [workspaceId, activeSessionId && sessionIds.includes(activeSessionId) ? activeSessionId : sessionIds[0]]
    }),
  )
}

function repairAllWorkspaceLayouts(
  layoutByWorkspaceId: Record<string, TerminalLayoutNode>,
  sessions: AgentSession[],
  workspaceIds: string[],
) {
  const sessionsByWorkspace = new Map<string, string[]>()
  for (const session of sessions) {
    if (!session.workspaceId) continue
    sessionsByWorkspace.set(session.workspaceId, [...(sessionsByWorkspace.get(session.workspaceId) ?? []), session.id])
  }

  const allWorkspaceIds = new Set([...workspaceIds, ...Object.keys(layoutByWorkspaceId), ...sessionsByWorkspace.keys()])
  return Object.fromEntries(
    [...allWorkspaceIds].map(workspaceId => {
      const sessionIds = sessionsByWorkspace.get(workspaceId) ?? []
      const layout = layoutByWorkspaceId[workspaceId] ?? cloneInitialLayout()
      return [workspaceId, attachMissingSessions(repairLayout(layout, sessionIds), sessionIds)]
    }),
  )
}

function getWorkspaceLayout(workspaceId: string | undefined, layoutByWorkspaceId: Record<string, TerminalLayoutNode>): TerminalLayoutNode {
  return workspaceId ? layoutByWorkspaceId[workspaceId] ?? cloneInitialLayout() : cloneInitialLayout()
}

function getWorkspaceActivePaneId(workspaceId: string | undefined, activePaneIdByWorkspaceId: Record<string, string>): string {
  return workspaceId ? activePaneIdByWorkspaceId[workspaceId] ?? initialPaneId : initialPaneId
}

function cloneInitialLayout(): TerminalLayoutNode {
  return {
    type: 'pane',
    id: initialPaneId,
    sessionIds: [],
  }
}

function workspaceNameFromPath(path: string): string {
  return path.replace(/\\/g, '/').split('/').filter(Boolean).at(-1) ?? 'Workspace'
}

function loadPersistedState(): PersistedWorkspaceState {
  if (typeof localStorage === 'undefined') {
    return emptyPersistedState()
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return emptyPersistedState()
    const parsed = JSON.parse(raw) as PersistedWorkspaceState
    return {
      workspaces: parsed.workspaces ?? [],
      activeWorkspaceId: parsed.activeWorkspaceId,
      layoutByWorkspaceId: parsed.layoutByWorkspaceId ?? {},
      activePaneIdByWorkspaceId: parsed.activePaneIdByWorkspaceId ?? {},
      activeSessionIdByWorkspaceId: parsed.activeSessionIdByWorkspaceId ?? {},
      previewUrlByWorkspaceId: parsed.previewUrlByWorkspaceId ?? {},
      previewPanelWidthByWorkspaceId: parsed.previewPanelWidthByWorkspaceId ?? {},
      previewPanelHiddenByWorkspaceId: parsed.previewPanelHiddenByWorkspaceId ?? {},
    }
  } catch {
    return emptyPersistedState()
  }
}

function emptyPersistedState(): PersistedWorkspaceState {
  return {
    workspaces: [],
    layoutByWorkspaceId: {},
    activePaneIdByWorkspaceId: {},
    activeSessionIdByWorkspaceId: {},
    previewUrlByWorkspaceId: {},
    previewPanelWidthByWorkspaceId: {},
    previewPanelHiddenByWorkspaceId: {},
  }
}

function persistWorkspaceState(state: Pick<AppState, 'workspaces' | 'activeWorkspaceId' | 'layoutByWorkspaceId' | 'activePaneIdByWorkspaceId' | 'activeSessionIdByWorkspaceId' | 'previewUrlByWorkspaceId' | 'previewPanelWidthByWorkspaceId' | 'previewPanelHiddenByWorkspaceId'>): void {
  if (typeof localStorage === 'undefined') return
  const persistedState: PersistedWorkspaceState = {
    workspaces: state.workspaces,
    activeWorkspaceId: state.activeWorkspaceId,
    layoutByWorkspaceId: state.layoutByWorkspaceId,
    activePaneIdByWorkspaceId: state.activePaneIdByWorkspaceId,
    activeSessionIdByWorkspaceId: state.activeSessionIdByWorkspaceId,
    previewUrlByWorkspaceId: state.previewUrlByWorkspaceId,
    previewPanelWidthByWorkspaceId: state.previewPanelWidthByWorkspaceId,
    previewPanelHiddenByWorkspaceId: state.previewPanelHiddenByWorkspaceId,
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(persistedState))
}

function normalizePreviewUrl(url: string): string | undefined {
  const trimmed = url.trim()
  if (!trimmed) return undefined
  const withProtocol = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`
  try {
    const parsed = new URL(withProtocol)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return undefined
    return parsed.toString()
  } catch {
    return undefined
  }
}
