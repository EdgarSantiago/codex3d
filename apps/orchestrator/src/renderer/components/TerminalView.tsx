import type { AgentSession } from '../../shared/types'
import { EmptyTerminalState } from './EmptyTerminalState'
import { TerminalPane } from './TerminalPane'

type TerminalViewProps = {
  session?: AgentSession
  output: string
  onInput: (input: string) => void
  onResize: (cols: number, rows: number) => void
  onNewTerminal: () => void
  onRestart: () => void
  onStop: () => void
}

export function TerminalView({ session, output, onInput, onResize, onNewTerminal, onRestart, onStop }: TerminalViewProps) {
  if (!session) {
    return (
      <div className="tabbed-terminal-view empty">
        <EmptyTerminalState
          title="No terminals"
          description="Create a new terminal tab to start an independent agent session."
          actionLabel="New Terminal"
          onAction={onNewTerminal}
        />
      </div>
    )
  }

  const canResumeCodex3D = session.provider === 'codex3d'

  if (session.status === 'stopped' && !output) {
    return (
      <div className="tabbed-terminal-view empty">
        <EmptyTerminalState
          title="Terminal stopped"
          description={canResumeCodex3D ? `Resume this chat with codex3d --resume ${session.id}` : 'Restart this tab to attach a new process to the same session.'}
          actionLabel={canResumeCodex3D ? 'Resume Terminal' : 'Restart Terminal'}
          onAction={onRestart}
        />
      </div>
    )
  }

  return (
    <div className={`tabbed-terminal-view ${session.status === 'stopped' && canResumeCodex3D ? 'resume-visible' : ''}`}>
      {session.status === 'stopped' && canResumeCodex3D ? (
        <div className="terminal-resume-banner" role="status" aria-live="polite">
          <div className="terminal-resume-icon" aria-hidden="true">↻</div>
          <div className="terminal-resume-copy">
            <strong>Session paused</strong>
            <span>Resume the previous Codex3D conversation.</span>
          </div>
          <button type="button" onClick={onRestart}>Resume</button>
        </div>
      ) : null}
      <TerminalPane
        sessionId={session.id}
        output={output}
        onInput={input => {
          if (session.status !== 'stopped' && session.status !== 'errored') onInput(input)
        }}
        onResize={onResize}
        onRestart={onRestart}
        onStop={onStop}
      />
    </div>
  )
}
