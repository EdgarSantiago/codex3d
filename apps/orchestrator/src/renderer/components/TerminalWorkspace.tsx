import type { AgentSession } from '../../shared/types'
import { EmptyTerminalState } from './EmptyTerminalState'
import { TerminalPane } from './TerminalPane'

type TerminalWorkspaceProps = {
  session?: AgentSession
  output: string
  onTerminalInput: (input: string) => void
  onTerminalResize: (cols: number, rows: number) => void
  onLaunch: () => void
  onRestart: () => void
}

export function TerminalWorkspace({
  session,
  output,
  onTerminalInput,
  onTerminalResize,
  onLaunch,
  onRestart,
}: TerminalWorkspaceProps) {
  if (!session) {
    return (
      <div className="terminal-workspace empty">
        <EmptyTerminalState
          title="No session selected"
          description="Launch a Codex3D session or select one from the sidebar."
          actionLabel="Launch Codex3D"
          onAction={onLaunch}
        />
      </div>
    )
  }

  if (session.status === 'stopped' && !output) {
    return (
      <div className="terminal-workspace empty">
        <EmptyTerminalState
          title="Session stopped"
          description="Restart this session to attach a fresh terminal process in the same slot."
          actionLabel="Restart session"
          onAction={onRestart}
        />
      </div>
    )
  }

  return (
    <div className="terminal-workspace">
      <TerminalPane
        sessionId={session.id}
        output={output}
        onInput={onTerminalInput}
        onResize={onTerminalResize}
      />
    </div>
  )
}
