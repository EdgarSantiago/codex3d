import { useEffect, useRef } from 'react'

type CommandPaletteAction = {
  id: string
  label: string
  description: string
  disabled?: boolean
  run: () => void
}

type CommandPaletteProps = {
  open: boolean
  actions: CommandPaletteAction[]
  onClose: () => void
}

export function CommandPalette({ open, actions, onClose }: CommandPaletteProps) {
  const firstButtonRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    if (!open) return
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : undefined
    window.requestAnimationFrame(() => firstButtonRef.current?.focus())
    return () => previous?.focus()
  }, [open])

  if (!open) return null

  return (
    <div className="palette-backdrop" role="presentation" onMouseDown={onClose}>
      <div
        className="command-palette"
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        onMouseDown={event => event.stopPropagation()}
      >
        <div className="palette-header">
          <div>
            <h2>Command palette</h2>
            <span>Ctrl+K / Cmd+K</span>
          </div>
          <button type="button" onClick={onClose} aria-label="Close command palette">Esc</button>
        </div>
        <div className="palette-actions">
          {actions.map((action, index) => (
            <button
              key={action.id}
              ref={index === 0 ? firstButtonRef : undefined}
              type="button"
              disabled={action.disabled}
              onClick={() => {
                action.run()
                onClose()
              }}
            >
              <strong>{action.label}</strong>
              <span>{action.description}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
