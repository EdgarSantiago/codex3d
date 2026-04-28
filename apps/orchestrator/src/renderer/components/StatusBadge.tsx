import type { AgentStatus } from '../../shared/types'

type StatusBadgeProps = {
  status: AgentStatus
}

export function StatusBadge({ status }: StatusBadgeProps) {
  return <span className={`status-badge status-${status}`}>{status}</span>
}
