type EmptyTerminalStateProps = {
  title: string
  description: string
  actionLabel?: string
  onAction?: () => void
}

export function EmptyTerminalState({ title, description, actionLabel, onAction }: EmptyTerminalStateProps) {
  return (
    <div className="empty-terminal-state">
      <div className="empty-terminal-glyph">▣</div>
      <h2>{title}</h2>
      <p>{description}</p>
      {actionLabel && onAction ? <button type="button" onClick={onAction}>{actionLabel}</button> : null}
    </div>
  )
}
