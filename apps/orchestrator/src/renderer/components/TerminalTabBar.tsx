import type { AgentSession } from '../../shared/types'
import type { TerminalSplitOrientation } from '../stores/appStore'
import { StatusBadge } from './StatusBadge'

export type TabContextMenuRequest = {
  session: AgentSession
  x: number
  y: number
}

type TerminalTabBarProps = {
  paneId: string
  sessions: AgentSession[]
  selectedSessionId?: string
  onSelectSession: (sessionId: string) => void
  onNewTerminal: () => void
  onRestartSelected: () => void
  onStopSelected: () => void
  onSplitPane: (orientation: TerminalSplitOrientation) => void
  onMoveSessionToPane: (sessionId: string, targetPaneId: string) => void
  onRequestCloseSession: (session: AgentSession) => void
  onRequestTabMenu: (request: TabContextMenuRequest) => void
  onClosePane: () => void
}

export function TerminalTabBar({
  paneId,
  sessions,
  selectedSessionId,
  onSelectSession,
  onNewTerminal,
  onRestartSelected,
  onStopSelected,
  onSplitPane,
  onMoveSessionToPane,
  onRequestCloseSession,
  onRequestTabMenu,
  onClosePane,
}: TerminalTabBarProps) {
  const selectedSession = sessions.find(session => session.id === selectedSessionId)

  return (
    <div className="terminal-tab-shell">
      <div
        className="terminal-tab-strip"
        role="tablist"
        aria-label="Terminal sessions"
        onDragOver={event => event.preventDefault()}
        onDrop={event => {
          event.preventDefault()
          const sessionId = event.dataTransfer.getData('application/x-codex3d-session')
          if (sessionId) onMoveSessionToPane(sessionId, paneId)
        }}
      >
        {sessions.map(session => (
          <button
            key={session.id}
            type="button"
            role="tab"
            draggable
            aria-selected={session.id === selectedSessionId}
            className={`terminal-tab ${session.id === selectedSessionId ? 'active' : ''}`}
            onClick={() => onSelectSession(session.id)}
            onContextMenu={event => {
              event.preventDefault()
              onSelectSession(session.id)
              onRequestTabMenu({ session, x: event.clientX, y: event.clientY })
            }}
            onDragStart={event => {
              event.dataTransfer.setData('application/x-codex3d-session', session.id)
              event.dataTransfer.effectAllowed = 'move'
            }}
            title={`${session.name} — ${session.cwd}`}
          >
            <span className="terminal-tab-icon">▣</span>
            <span className="terminal-tab-title">{session.name}</span>
            <StatusBadge status={session.status} />
            <span
              className="terminal-tab-close"
              role="button"
              tabIndex={0}
              aria-label={`Close terminal ${session.name}`}
              title={`Close terminal ${session.name}`}
              onClick={event => {
                event.stopPropagation()
                onRequestCloseSession(session)
              }}
              onKeyDown={event => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  event.stopPropagation()
                  onRequestCloseSession(session)
                }
              }}
            >
              ×
            </span>
          </button>
        ))}
      </div>

      <div className="terminal-tab-actions">
        <button type="button" className="tab-action primary-tab-action" onClick={onNewTerminal} aria-label="New terminal" title="New terminal: start another Codex3D session in this workspace">+</button>
        <button type="button" className="tab-action" onClick={() => onSplitPane('horizontal')} aria-label="Split panel horizontally" title="Split horizontally: show another panel side-by-side">Split ↔</button>
        <button type="button" className="tab-action" onClick={() => onSplitPane('vertical')} aria-label="Split panel vertically" title="Split vertically: show another panel above or below">Split ↕</button>
        <button type="button" className="tab-action" disabled={!selectedSession} onClick={onRestartSelected} aria-label="Restart selected terminal" title="Restart: stop and relaunch the selected terminal in the same workspace folder">Restart</button>
        <button type="button" className="tab-action" disabled={!selectedSession || selectedSession.status === 'stopped'} onClick={onStopSelected} aria-label="Stop selected terminal" title="Stop: terminate the selected terminal process">Stop</button>
        <button type="button" className="tab-action pane-tab-action" onClick={onClosePane} aria-label="Close split panel" title="Close panel: remove this split panel after confirmation">×</button>
      </div>
    </div>
  )
}
