import type { AgentSession } from '../../shared/types'
import { EmptyTerminalState } from './EmptyTerminalState'
import { StatusBadge } from './StatusBadge'
import { TerminalPane } from './TerminalPane'

type TerminalCardProps = {
  session: AgentSession
  output: string
  selected: boolean
  onSelect: () => void
  onRestart: () => void
  onStop: () => void
  onInput: (input: string) => void
  onResize: (cols: number, rows: number) => void
}

export function TerminalCard({
  session,
  output,
  selected,
  onSelect,
  onRestart,
  onStop,
  onInput,
  onResize,
}: TerminalCardProps) {
  return (
    <section className={`terminal-session-card ${selected ? 'selected' : ''}`} onFocus={onSelect}>
      <header className="terminal-session-header">
        <button type="button" className="terminal-session-title" onClick={onSelect}>
          <strong>{session.name}</strong>
          <span>{session.cwd}</span>
        </button>
        <div className="terminal-session-controls">
          <StatusBadge status={session.status} />
          <button type="button" onClick={onRestart}>Restart</button>
          <button type="button" disabled={session.status === 'stopped'} onClick={onStop}>Stop</button>
        </div>
      </header>

      {session.status === 'stopped' && !output ? (
        <EmptyTerminalState
          title="Terminal stopped"
          description="Restart this terminal to create a new process in the same session."
          actionLabel="Restart"
          onAction={onRestart}
        />
      ) : (
        <TerminalPane
          sessionId={session.id}
          output={output}
          onInput={onInput}
          onResize={onResize}
        />
      )}
    </section>
  )
}
