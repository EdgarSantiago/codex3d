import type { KeyboardEvent } from 'react'

type TerminalInputProps = {
  value: string
  disabled: boolean
  onChange: (value: string) => void
  onSend: () => void
}

export function TerminalInput({ value, disabled, onChange, onSend }: TerminalInputProps) {
  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault()
      onSend()
    }
  }

  return (
    <div className="terminal-input-bar">
      <span className="terminal-prompt">›</span>
      <input
        value={value}
        disabled={disabled}
        onChange={event => onChange(event.target.value)}
        onKeyDown={onKeyDown}
        placeholder="Type a prompt or slash command, then Ctrl+Enter"
        aria-label="Prompt for selected session"
      />
      <button type="button" disabled={disabled || !value.trim()} onClick={onSend}>Send</button>
    </div>
  )
}
