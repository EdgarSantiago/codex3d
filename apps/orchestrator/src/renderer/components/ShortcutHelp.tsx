type ShortcutHelpProps = {
  onOpenPalette: () => void
}

export function ShortcutHelp({ onOpenPalette }: ShortcutHelpProps) {
  return (
    <footer className="shortcut-footer">
      <button type="button" onClick={onOpenPalette}>Ctrl/⌘ K Palette</button>
      <span>Type directly in terminal</span>
      <span>Ctrl+R Restart</span>
      <span>Ctrl+S Stop</span>
      <span>Ctrl+L Clear</span>
      <span>Esc Close</span>
    </footer>
  )
}
