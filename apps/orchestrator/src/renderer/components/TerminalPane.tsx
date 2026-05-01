import { useEffect, useRef } from 'react'
import { Terminal } from 'xterm'
import { FitAddon } from 'xterm-addon-fit'
import 'xterm/css/xterm.css'

type TerminalPaneProps = {
  sessionId?: string
  output: string
  onInput: (input: string) => void
  onResize: (cols: number, rows: number) => void
  onClear?: () => void
  onRestart?: () => void
  onStop?: () => void
  emptyMessage?: string
  connectedMessage?: string
}

export function TerminalPane({
  sessionId,
  output,
  onInput,
  onResize,
  onClear,
  onRestart,
  onStop,
  emptyMessage = 'Launch an agent to open a terminal.',
  connectedMessage = 'Connected to session.',
}: TerminalPaneProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const terminalRef = useRef<Terminal | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const writtenLengthRef = useRef(0)
  const lastSizeRef = useRef({ cols: 0, rows: 0 })
  const sessionIdRef = useRef<string | undefined>(undefined)
  const onInputRef = useRef(onInput)
  const onResizeRef = useRef(onResize)
  const onClearRef = useRef(onClear)
  const onRestartRef = useRef(onRestart)
  const onStopRef = useRef(onStop)
  const outputLengthRef = useRef(output.length)

  onInputRef.current = onInput
  onResizeRef.current = onResize
  onClearRef.current = onClear
  onRestartRef.current = onRestart
  onStopRef.current = onStop
  outputLengthRef.current = output.length

  useEffect(() => {
    const container = containerRef.current
    if (!container || terminalRef.current) return

    const terminal = new Terminal({
      cursorBlink: true,
      convertEol: true,
      disableStdin: false,
      scrollback: 10000,
      allowProposedApi: false,
      fontFamily: 'JetBrains Mono, Cascadia Code, Consolas, monospace',
      fontSize: 13,
      lineHeight: 1.15,
      theme: {
        background: '#08060a',
        foreground: '#ece4ea',
        cursor: '#ff2e4e',
        selectionBackground: '#5f1724',
        black: '#08060a',
        red: '#ff2e4e',
        green: '#f97316',
        yellow: '#facc15',
        blue: '#fb7185',
        magenta: '#dc2626',
        cyan: '#f87171',
        white: '#ece4ea',
        brightBlack: '#5e4d59',
        brightRed: '#ff4d68',
        brightGreen: '#fb923c',
        brightYellow: '#fde68a',
        brightBlue: '#fda4af',
        brightMagenta: '#ef4444',
        brightCyan: '#fecaca',
        brightWhite: '#fff1f2',
      },
    })
    const fitAddon = new FitAddon()
    terminal.loadAddon(fitAddon)
    terminal.open(container)
    terminal.write(`${emptyMessage}\r\n`)

    const reportSize = () => {
      if (!container.isConnected || container.clientWidth === 0 || container.clientHeight === 0) return
      try {
        fitAddon.fit()
      } catch {
        return
      }
      const next = { cols: terminal.cols, rows: terminal.rows }
      const previous = lastSizeRef.current
      if (next.cols !== previous.cols || next.rows !== previous.rows) {
        lastSizeRef.current = next
        onResizeRef.current(next.cols, next.rows)
      }
    }

    terminal.attachCustomKeyEventHandler(event => {
      if (event.type !== 'keydown') return true

      const key = event.key.toLowerCase()
      const usesPrimaryModifier = (event.ctrlKey || event.metaKey) && !event.altKey

      if (usesPrimaryModifier && key === 'c') {
        if (!terminal.hasSelection()) return true
        event.preventDefault()
        void navigator.clipboard.writeText(terminal.getSelection()).then(() => terminal.clearSelection())
        return false
      }

      if (usesPrimaryModifier && key === 'v') {
        event.preventDefault()
        void navigator.clipboard.readText().then(text => {
          if (text) onInputRef.current(text)
        })
        return false
      }

      if (!event.ctrlKey || event.metaKey || event.altKey) {
        return true
      }

      if (key === 'l') {
        event.preventDefault()
        terminal.clear()
        writtenLengthRef.current = outputLengthRef.current
        onClearRef.current?.()
        return false
      }
      if (key === 'r') {
        event.preventDefault()
        onRestartRef.current?.()
        return false
      }
      if (key === 's') {
        event.preventDefault()
        onStopRef.current?.()
        return false
      }

      return true
    })

    const inputDisposable = terminal.onData(data => onInputRef.current(data))
    const resizeObserver = new ResizeObserver(() => {
      window.requestAnimationFrame(reportSize)
    })
    resizeObserver.observe(container)

    terminalRef.current = terminal
    fitAddonRef.current = fitAddon
    window.requestAnimationFrame(reportSize)

    return () => {
      inputDisposable.dispose()
      resizeObserver.disconnect()
      terminal.dispose()
      terminalRef.current = null
      fitAddonRef.current = null
    }
  }, [])

  useEffect(() => {
    const terminal = terminalRef.current
    if (!terminal || sessionIdRef.current === sessionId) return

    sessionIdRef.current = sessionId
    writtenLengthRef.current = 0
    terminal.clear()
    terminal.write(sessionId ? `${connectedMessage}\r\n` : `${emptyMessage}\r\n`)
    window.requestAnimationFrame(() => {
      try {
        fitAddonRef.current?.fit()
      } catch {
        // The pane can be hidden or mid-layout when switching workspaces.
      }
    })
  }, [connectedMessage, emptyMessage, sessionId])

  useEffect(() => {
    const terminal = terminalRef.current
    if (!terminal) return

    const nextChunk = output.slice(writtenLengthRef.current)
    if (!nextChunk) return
    terminal.write(nextChunk)
    writtenLengthRef.current = output.length
  }, [output])

  return <div ref={containerRef} className="xterm-container" />
}
