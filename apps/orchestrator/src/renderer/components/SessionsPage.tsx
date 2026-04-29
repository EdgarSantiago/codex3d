import { useCallback, useEffect, useState } from 'react'
import type { AgentSession, Workspace } from '../../shared/types'
import type { TerminalLayoutNode, TerminalSplitOrientation } from '../stores/appStore'
import { TerminalTabBar, type TabContextMenuRequest } from './TerminalTabBar'
import { TerminalView } from './TerminalView'

type SessionsPageProps = {
  workspaces: Workspace[]
  activeWorkspaceId?: string
  onSelectWorkspace: (workspaceId: string) => void
  onAddWorkspace: () => Promise<void>
  sessions: AgentSession[]
  selectedSessionId?: string
  outputBySession: Record<string, string>
  terminalLayout: TerminalLayoutNode
  activePaneId: string
  onSelectSession: (sessionId: string) => void
  onSelectPane: (paneId: string) => void
  onSelectPaneSession: (paneId: string, sessionId: string) => void
  onSplitPane: (paneId: string, orientation: TerminalSplitOrientation) => void
  onMoveSessionToPane: (sessionId: string, targetPaneId: string) => void
  onClosePane: (paneId: string) => void
  onLaunchSession: () => Promise<void>
  onRestartSession: (sessionId: string) => Promise<void>
  onStopSession: (sessionId: string) => Promise<void>
  onCloseSession: (sessionId: string) => Promise<void>
  onRenameSession: (sessionId: string, name: string) => void
  onSendInput: (sessionId: string, input: string) => Promise<void>
  onResizeTerminal: (sessionId: string, cols: number, rows: number) => void
}

export function SessionsPage({
  workspaces,
  activeWorkspaceId,
  onSelectWorkspace,
  onAddWorkspace,
  sessions,
  selectedSessionId,
  outputBySession,
  terminalLayout,
  activePaneId,
  onSelectSession,
  onSelectPane,
  onSelectPaneSession,
  onSplitPane,
  onMoveSessionToPane,
  onClosePane,
  onLaunchSession,
  onRestartSession,
  onStopSession,
  onCloseSession,
  onRenameSession,
  onSendInput,
  onResizeTerminal,
}: SessionsPageProps) {
  const [busy, setBusy] = useState(false)
  const [pendingRenameSession, setPendingRenameSession] = useState<AgentSession | undefined>()
  const [tabMenu, setTabMenu] = useState<TabContextMenuRequest | undefined>()
  const [renameValue, setRenameValue] = useState('')
  const [pendingCloseSession, setPendingCloseSession] = useState<AgentSession | undefined>()
  const [pendingClosePaneId, setPendingClosePaneId] = useState<string | undefined>()

  useEffect(() => {
    const firstSessionId = sessions[0]?.id
    if (!firstSessionId || selectedSessionId === firstSessionId) return
    const selectedBelongsToWorkspace = selectedSessionId ? sessions.some(session => session.id === selectedSessionId) : false
    if (!selectedBelongsToWorkspace) {
      onSelectSession(firstSessionId)
    }
  }, [onSelectSession, selectedSessionId, sessions])

  const launchSession = useCallback(async () => {
    setBusy(true)
    try {
      await onLaunchSession()
    } finally {
      setBusy(false)
    }
  }, [onLaunchSession])

  const restartSession = useCallback(async (sessionId?: string) => {
    if (!sessionId) return
    setBusy(true)
    try {
      await onRestartSession(sessionId)
    } finally {
      setBusy(false)
    }
  }, [onRestartSession])

  const stopSession = useCallback(async (sessionId?: string) => {
    if (!sessionId) return
    setBusy(true)
    try {
      await onStopSession(sessionId)
    } finally {
      setBusy(false)
    }
  }, [onStopSession])

  const closePendingSession = useCallback(async () => {
    if (!pendingCloseSession) return
    setBusy(true)
    try {
      await onCloseSession(pendingCloseSession.id)
      setPendingCloseSession(undefined)
    } finally {
      setBusy(false)
    }
  }, [onCloseSession, pendingCloseSession])

  const renamePendingSession = useCallback(() => {
    if (!pendingRenameSession) return
    const nextName = renameValue.trim()
    if (nextName) onRenameSession(pendingRenameSession.id, nextName)
    setPendingRenameSession(undefined)
    setRenameValue('')
  }, [onRenameSession, pendingRenameSession, renameValue])

  const closePendingPane = useCallback(() => {
    if (!pendingClosePaneId) return
    onClosePane(pendingClosePaneId)
    setPendingClosePaneId(undefined)
  }, [onClosePane, pendingClosePaneId])

  const sessionsById = new Map(sessions.map(session => [session.id, session]))

  return (
    <div className="sessions-shell">
      <div className="sessions-workspace-switcher">
        <div className="workspace-chip-row" aria-label="Workspace switcher">
          {workspaces.map(workspace => (
            <button
              type="button"
              key={workspace.id}
              className={`workspace-chip ${workspace.id === activeWorkspaceId ? 'active' : ''}`}
              onClick={() => onSelectWorkspace(workspace.id)}
              title={workspace.path}
            >
              {workspace.name}
            </button>
          ))}
          <button type="button" className="workspace-chip add" onClick={() => void onAddWorkspace()}>+ Add</button>
        </div>
        <span>{workspaces.find(workspace => workspace.id === activeWorkspaceId)?.path ?? 'No workspace selected'}</span>
      </div>

      <div className="tabbed-sessions-page" aria-busy={busy}>
      <SplitNodeView
        node={terminalLayout}
        sessionsById={sessionsById}
        outputBySession={outputBySession}
        activePaneId={activePaneId}
        onSelectPane={onSelectPane}
        onSelectSession={onSelectSession}
        onSelectPaneSession={onSelectPaneSession}
        onSplitPane={onSplitPane}
        onMoveSessionToPane={onMoveSessionToPane}
        onClosePane={setPendingClosePaneId}
        onRequestCloseSession={session => {
          setPendingCloseSession(session)
        }}
        onRequestTabMenu={request => setTabMenu(request)}
        onLaunchSession={launchSession}
        onRestartSession={restartSession}
        onStopSession={stopSession}
        onSendInput={onSendInput}
        onResizeTerminal={onResizeTerminal}
      />

      {pendingCloseSession ? (
        <div className="modal-backdrop" role="presentation">
          <div className="confirm-modal" role="dialog" aria-modal="true" aria-labelledby="close-terminal-title">
            <h2 id="close-terminal-title">Close terminal?</h2>
            <p>This will stop and remove {pendingCloseSession.name} from the layout.</p>
            <span>{pendingCloseSession.cwd}</span>
            <div className="confirm-modal-actions">
              <button type="button" onClick={() => setPendingCloseSession(undefined)}>Cancel</button>
              <button type="button" className="danger-button" onClick={() => void closePendingSession()}>Close terminal</button>
            </div>
          </div>
        </div>
      ) : null}

      {tabMenu ? (
        <div className="context-menu-layer" role="presentation" onMouseDown={() => setTabMenu(undefined)}>
          <div
            className="tab-context-menu"
            role="menu"
            style={{ left: tabMenu.x, top: tabMenu.y }}
            onMouseDown={event => event.stopPropagation()}
          >
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setPendingRenameSession(tabMenu.session)
                setRenameValue(tabMenu.session.name)
                setTabMenu(undefined)
              }}
            >
              Rename
            </button>
          </div>
        </div>
      ) : null}

      {pendingRenameSession ? (
        <div className="modal-backdrop" role="presentation">
          <div className="confirm-modal" role="dialog" aria-modal="true" aria-labelledby="rename-terminal-title">
            <h2 id="rename-terminal-title">Rename terminal</h2>
            <p>Set a local display name for this terminal tab.</p>
            <input
              value={renameValue}
              onChange={event => setRenameValue(event.target.value)}
              onKeyDown={event => {
                if (event.key === 'Enter') renamePendingSession()
                if (event.key === 'Escape') setPendingRenameSession(undefined)
              }}
              autoFocus
            />
            <div className="confirm-modal-actions">
              <button type="button" onClick={() => setPendingRenameSession(undefined)}>Cancel</button>
              <button type="button" className="danger-button" onClick={renamePendingSession}>Rename</button>
            </div>
          </div>
        </div>
      ) : null}

      {pendingClosePaneId ? (
        <div className="modal-backdrop" role="presentation">
          <div className="confirm-modal" role="dialog" aria-modal="true" aria-labelledby="close-pane-title">
            <h2 id="close-pane-title">Close split panel?</h2>
            <p>This closes the split panel. Terminal tabs inside it will move with the remaining layout only if already moved elsewhere.</p>
            <div className="confirm-modal-actions">
              <button type="button" onClick={() => setPendingClosePaneId(undefined)}>Cancel</button>
              <button type="button" className="danger-button" onClick={closePendingPane}>Close panel</button>
            </div>
          </div>
        </div>
      ) : null}
      </div>
    </div>
  )
}

type SplitNodeViewProps = {
  node: TerminalLayoutNode
  sessionsById: Map<string, AgentSession>
  outputBySession: Record<string, string>
  activePaneId: string
  onSelectPane: (paneId: string) => void
  onSelectSession: (sessionId: string) => void
  onSelectPaneSession: (paneId: string, sessionId: string) => void
  onSplitPane: (paneId: string, orientation: TerminalSplitOrientation) => void
  onMoveSessionToPane: (sessionId: string, targetPaneId: string) => void
  onClosePane: (paneId: string) => void
  onRequestCloseSession: (session: AgentSession) => void
  onRequestTabMenu: (request: TabContextMenuRequest) => void
  onLaunchSession: () => Promise<void>
  onRestartSession: (sessionId?: string) => Promise<void>
  onStopSession: (sessionId?: string) => Promise<void>
  onSendInput: (sessionId: string, input: string) => Promise<void>
  onResizeTerminal: (sessionId: string, cols: number, rows: number) => void
}

function SplitNodeView(props: SplitNodeViewProps) {
  const { node } = props
  if (node.type === 'split') {
    return (
      <div className={`terminal-split terminal-split-${node.orientation}`}>
        {node.children.map(child => <SplitNodeView key={child.id} {...props} node={child} />)}
      </div>
    )
  }

  const paneSessions = node.sessionIds.map(id => props.sessionsById.get(id)).filter((session): session is AgentSession => Boolean(session))
  const selectedSession = paneSessions.find(session => session.id === node.activeSessionId) ?? paneSessions[0]
  const visibleOutput = selectedSession ? props.outputBySession[selectedSession.id] ?? '' : ''

  return (
    <section
      className={`terminal-pane-frame ${node.id === props.activePaneId ? 'active' : ''}`}
      onFocus={() => props.onSelectPane(node.id)}
      onMouseDown={() => props.onSelectPane(node.id)}
    >
      <TerminalTabBar
        paneId={node.id}
        sessions={paneSessions}
        selectedSessionId={selectedSession?.id}
        onSelectSession={sessionId => {
          props.onSelectPaneSession(node.id, sessionId)
          props.onSelectSession(sessionId)
        }}
        onNewTerminal={() => void props.onLaunchSession()}
        onRestartSelected={() => void props.onRestartSession(selectedSession?.id)}
        onStopSelected={() => void props.onStopSession(selectedSession?.id)}
        onSplitPane={orientation => props.onSplitPane(node.id, orientation)}
        onMoveSessionToPane={props.onMoveSessionToPane}
        onRequestCloseSession={props.onRequestCloseSession}
        onRequestTabMenu={props.onRequestTabMenu}
        onClosePane={() => props.onClosePane(node.id)}
      />
      <TerminalView
        session={selectedSession}
        output={visibleOutput}
        onInput={input => {
          if (selectedSession) void props.onSendInput(selectedSession.id, input)
        }}
        onResize={(cols, rows) => {
          if (selectedSession) props.onResizeTerminal(selectedSession.id, cols, rows)
        }}
        onNewTerminal={() => void props.onLaunchSession()}
        onRestart={() => void props.onRestartSession(selectedSession?.id)}
        onStop={() => void props.onStopSession(selectedSession?.id)}
      />
    </section>
  )
}
