import { useCallback, useEffect, useState } from 'react'
import type { AgentSession } from '../../shared/types'
import type { TerminalLayoutNode, TerminalSplitOrientation } from '../stores/appStore'
import { TerminalTabBar } from './TerminalTabBar'
import { TerminalView } from './TerminalView'

type SessionsPageProps = {
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
  onLaunchSession: () => Promise<void>
  onRestartSession: (sessionId: string) => Promise<void>
  onStopSession: (sessionId: string) => Promise<void>
  onCloseSession: (sessionId: string) => Promise<void>
  onSendInput: (sessionId: string, input: string) => Promise<void>
  onResizeTerminal: (sessionId: string, cols: number, rows: number) => void
}

export function SessionsPage({
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
  onLaunchSession,
  onRestartSession,
  onStopSession,
  onCloseSession,
  onSendInput,
  onResizeTerminal,
}: SessionsPageProps) {
  const [busy, setBusy] = useState(false)
  const [pendingCloseSession, setPendingCloseSession] = useState<AgentSession | undefined>()

  useEffect(() => {
    if (!selectedSessionId && sessions[0]) {
      onSelectSession(sessions[0].id)
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

  const sessionsById = new Map(sessions.map(session => [session.id, session]))

  return (
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
        onRequestCloseSession={setPendingCloseSession}
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
  onRequestCloseSession: (session: AgentSession) => void
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
