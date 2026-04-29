import { randomUUID } from 'crypto'
import type { IPty } from 'node-pty'
import { spawn } from 'node-pty'
import type { CreateDevTerminalInput, DevTerminal } from '../../shared/types'

export type DevTerminalOutputHandler = (event: { terminalId: string; chunk: string }) => void
export type DevTerminalStatusHandler = (terminal: DevTerminal) => void

const MAX_OUTPUT_CHARS = 1024 * 1024

class DevTerminalManager {
  private processes = new Map<string, IPty>()
  private terminals = new Map<string, DevTerminal>()
  private outputByTerminal: Record<string, string> = {}
  private stoppingTerminals = new Set<string>()
  private onOutput?: DevTerminalOutputHandler
  private onStatus?: DevTerminalStatusHandler

  setHandlers(handlers: { onOutput: DevTerminalOutputHandler; onStatus: DevTerminalStatusHandler }): void {
    this.onOutput = handlers.onOutput
    this.onStatus = handlers.onStatus
  }

  list(): DevTerminal[] {
    return [...this.terminals.values()]
  }

  outputs(): Record<string, string> {
    return { ...this.outputByTerminal }
  }

  create(input: CreateDevTerminalInput): DevTerminal {
    const id = randomUUID()
    const now = Date.now()
    const shell = getShell()
    const terminal: DevTerminal = {
      id,
      workspaceId: input.workspaceId,
      name: input.name ?? `Dev ${this.terminals.size + 1}`,
      cwd: input.cwd,
      shell,
      status: 'starting',
      createdAt: now,
      updatedAt: now,
    }

    this.terminals.set(id, terminal)
    this.onStatus?.(terminal)
    this.startPty(terminal)
    return this.terminals.get(id)!
  }

  sendInput(terminalId: string, input: string): void {
    const pty = this.processes.get(terminalId)
    if (!pty) return
    pty.write(input)
  }

  resize(terminalId: string, cols: number, rows: number): void {
    const pty = this.processes.get(terminalId)
    if (!pty) return
    pty.resize(cols, rows)
  }

  rename(terminalId: string, name: string): DevTerminal {
    const current = this.terminals.get(terminalId)
    if (!current) throw new Error(`Unknown dev terminal: ${terminalId}`)
    const next = { ...current, name, updatedAt: Date.now() }
    this.terminals.set(terminalId, next)
    this.onStatus?.(next)
    return next
  }

  stop(terminalId: string): void {
    const pty = this.processes.get(terminalId)
    if (!pty) return
    this.stoppingTerminals.add(terminalId)
    this.processes.delete(terminalId)
    pty.kill()
    this.updateStatus(terminalId, 'stopped')
  }

  remove(terminalId: string): void {
    this.stop(terminalId)
    this.terminals.delete(terminalId)
    delete this.outputByTerminal[terminalId]
  }

  private startPty(terminal: DevTerminal): void {
    try {
      const pty = spawn(terminal.shell, [], {
        name: process.platform === 'win32' ? 'xterm-256color' : 'xterm-color',
        cols: 100,
        rows: 20,
        cwd: terminal.cwd,
        env: getStringEnv(),
        useConpty: process.platform === 'win32',
      })
      this.processes.set(terminal.id, pty)
      this.updateStatus(terminal.id, 'running')
      this.appendOutput(terminal.id, `\r\n[dev] shell ${terminal.shell}\r\n[dev] cwd ${terminal.cwd}\r\n`)

      pty.onData(chunk => this.appendOutput(terminal.id, chunk))
      pty.onExit(event => {
        if (this.processes.get(terminal.id) !== pty) return
        this.processes.delete(terminal.id)
        const stoppedByUser = this.stoppingTerminals.delete(terminal.id)
        this.appendOutput(terminal.id, `\r\n[dev] exited with code ${event.exitCode}\r\n`)
        this.updateStatus(terminal.id, stoppedByUser || event.exitCode === 0 ? 'stopped' : 'errored')
      })
    } catch (error) {
      this.appendOutput(terminal.id, `\r\n[dev] ${error instanceof Error ? error.message : 'Failed to launch terminal'}\r\n`)
      this.updateStatus(terminal.id, 'errored')
    }
  }

  private appendOutput(terminalId: string, chunk: string): void {
    const nextOutput = `${this.outputByTerminal[terminalId] ?? ''}${chunk}`
    this.outputByTerminal[terminalId] = nextOutput.slice(-MAX_OUTPUT_CHARS)
    this.onOutput?.({ terminalId, chunk })
  }

  private updateStatus(terminalId: string, status: DevTerminal['status']): void {
    const current = this.terminals.get(terminalId)
    if (!current) return
    const next = { ...current, status, updatedAt: Date.now() }
    this.terminals.set(terminalId, next)
    this.onStatus?.(next)
  }
}

function getShell(): string {
  if (process.platform === 'win32') return process.env.ComSpec || 'cmd.exe'
  return process.env.SHELL || '/bin/sh'
}

function getStringEnv(): Record<string, string> {
  return Object.fromEntries(
    Object.entries(process.env).filter((entry): entry is [string, string] => typeof entry[1] === 'string'),
  )
}

export const devTerminalManager = new DevTerminalManager()
