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
          description="Create a new terminal tab to start an independent Codex3D session."
          actionLabel="New Terminal"
          onAction={onNewTerminal}
        />
      </div>
    )
  }

  if (session.status === 'stopped' && !output) {
    return (
      <div className="tabbed-terminal-view empty">
        <EmptyTerminalState
          title="Terminal stopped"
          description="Restart this tab to attach a new process to the same session."
          actionLabel="Restart Terminal"
          onAction={onRestart}
        />
      </div>
    )
  }

  return (
    <div className="tabbed-terminal-view">
      <TerminalPane
        sessionId={session.id}
        output={output}
        onInput={onInput}
        onResize={onResize}
        onRestart={onRestart}
        onStop={onStop}
      />
    </div>
  )
}
