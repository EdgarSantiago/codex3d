import type { AgentSession } from '../../shared/types'
import { StatusBadge } from './StatusBadge'

type SessionListItemProps = {
  session: AgentSession
  selected: boolean
  onSelect: () => void
}

export function SessionListItem({ session, selected, onSelect }: SessionListItemProps) {
  return (
    <button
      type="button"
      className={`session-list-item ${selected ? 'selected' : ''}`}
      onClick={onSelect}
      aria-pressed={selected}
      aria-label={`Select ${session.name}`}
    >
      <div className="session-list-main">
        <span className="session-name">{session.name}</span>
        <span className="session-path">{session.cwd}</span>
      </div>
      <div className="session-list-meta">
        <StatusBadge status={session.status} />
        <span>{session.provider}</span>
      </div>
    </button>
  )
}
