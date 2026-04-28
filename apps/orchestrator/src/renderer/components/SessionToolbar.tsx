import type { AgentSession } from '../../shared/types'
import { StatusBadge } from './StatusBadge'

type SessionToolbarProps = {
  session?: AgentSession
  onLaunch: () => void
  onRestart: () => void
  onStop: () => void
  onClear: () => void
  onCopyPath: () => void
  onOpenPalette: () => void
  busy: boolean
}

export function SessionToolbar({
  session,
  onLaunch,
  onRestart,
  onStop,
  onClear,
  onCopyPath,
  onOpenPalette,
  busy,
}: SessionToolbarProps) {
  return (
    <div className="session-toolbar">
      <div className="session-toolbar-title">
        <div>
          <h2>{session?.name ?? 'No session selected'}</h2>
          <span>{session?.cwd ?? 'Launch or select a Codex3D session'}</span>
        </div>
        {session ? <StatusBadge status={session.status} /> : null}
      </div>

      <div className="session-toolbar-actions">
        <button type="button" onClick={onLaunch}>New</button>
        <button type="button" disabled={!session || busy} onClick={onRestart}>Restart</button>
        <button type="button" disabled={!session || busy || session.status === 'stopped'} onClick={onStop}>Stop</button>
        <button type="button" disabled={!session} onClick={onClear}>Clear</button>
        <button type="button" disabled={!session} onClick={onCopyPath}>Copy path</button>
        <button type="button" onClick={onOpenPalette}>Ctrl+K</button>
      </div>
    </div>
  )
}
