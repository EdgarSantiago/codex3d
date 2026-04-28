import type { AgentSession, AgentStatus } from '../../shared/types'
import { SessionListItem } from './SessionListItem'

const filters: Array<'all' | AgentStatus> = ['all', 'running', 'starting', 'stopped', 'errored']

type SessionsSidebarProps = {
  sessions: AgentSession[]
  selectedSessionId?: string
  search: string
  filter: 'all' | AgentStatus
  onSearchChange: (search: string) => void
  onFilterChange: (filter: 'all' | AgentStatus) => void
  onSelectSession: (sessionId: string) => void
  onLaunchSession: () => void
}

export function SessionsSidebar({
  sessions,
  selectedSessionId,
  search,
  filter,
  onSearchChange,
  onFilterChange,
  onSelectSession,
  onLaunchSession,
}: SessionsSidebarProps) {
  const normalizedSearch = search.trim().toLowerCase()
  const visibleSessions = sessions.filter(session => {
    const matchesFilter = filter === 'all' || session.status === filter
    const haystack = `${session.name} ${session.cwd} ${session.status} ${session.provider}`.toLowerCase()
    return matchesFilter && (!normalizedSearch || haystack.includes(normalizedSearch))
  })

  return (
    <aside className="sessions-sidebar-panel" aria-label="Sessions">
      <div className="sessions-sidebar-header">
        <div>
          <h2>Sessions</h2>
          <span>{sessions.length} total</span>
        </div>
        <button type="button" className="icon-button" onClick={onLaunchSession} aria-label="Launch Codex3D session">+</button>
      </div>

      <label className="session-search-label">
        <span>Search</span>
        <input
          value={search}
          onChange={event => onSearchChange(event.target.value)}
          placeholder="name, path, status..."
        />
      </label>

      <div className="session-filters" role="tablist" aria-label="Session filters">
        {filters.map(value => (
          <button
            type="button"
            key={value}
            className={value === filter ? 'active' : ''}
            onClick={() => onFilterChange(value)}
          >
            {value}
          </button>
        ))}
      </div>

      <div className="session-list">
        {visibleSessions.length === 0 ? (
          <div className="sidebar-empty">No matching sessions.</div>
        ) : visibleSessions.map(session => (
          <SessionListItem
            key={session.id}
            session={session}
            selected={session.id === selectedSessionId}
            onSelect={() => onSelectSession(session.id)}
          />
        ))}
      </div>
    </aside>
  )
}
