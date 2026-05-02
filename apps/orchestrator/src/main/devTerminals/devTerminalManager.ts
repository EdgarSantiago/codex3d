import { randomUUID } from 'crypto'
import { app } from 'electron'
import { existsSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import type { IPty } from 'node-pty'
import { spawn } from 'node-pty'
import type { CreateDevTerminalInput, DevTerminal } from '../../shared/types'
import { getInteractiveShellArgs, getSafeCwd, getTerminalEnv, getUserShell, resolveExecutable } from '../platform/terminal'

export type DevTerminalOutputHandler = (event: { terminalId: string; chunk: string }) => void
export type DevTerminalStatusHandler = (terminal: DevTerminal) => void

const MAX_OUTPUT_CHARS = 1024 * 1024

type PersistedDevTerminals = {
  terminals: DevTerminal[]
  outputByTerminal: Record<string, string>
}

class DevTerminalManager {
  private processes = new Map<string, IPty>()
  private terminals = new Map<string, DevTerminal>()
  private outputByTerminal: Record<string, string> = {}
  private stoppingTerminals = new Set<string>()
  private onOutput?: DevTerminalOutputHandler
  private onStatus?: DevTerminalStatusHandler

  constructor() {
    this.loadPersistedState()
  }

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
    this.persistState()
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
    this.persistState()
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
    this.persistState()
  }

  private startPty(terminal: DevTerminal): void {
    try {
      const shell = resolveExecutable(terminal.shell)
      const pty = spawn(shell, getInteractiveShellArgs(shell), {
        name: 'xterm-256color',
        cols: 100,
        rows: 20,
        cwd: getSafeCwd(terminal.cwd),
        env: getTerminalEnv(),
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
    this.persistState()
    this.onOutput?.({ terminalId, chunk })
  }

  private updateStatus(terminalId: string, status: DevTerminal['status']): void {
    const current = this.terminals.get(terminalId)
    if (!current) return
    const next = { ...current, status, updatedAt: Date.now() }
    this.terminals.set(terminalId, next)
    this.persistState()
    this.onStatus?.(next)
  }

  private loadPersistedState(): void {
    const path = getPersistencePath()
    if (!existsSync(path)) return
    try {
      const parsed = JSON.parse(readFileSync(path, 'utf8')) as PersistedDevTerminals
      const now = Date.now()
      const terminalsToRestart: DevTerminal[] = []
      for (const terminal of parsed.terminals ?? []) {
        const shouldRestart = terminal.status !== 'stopped' && terminal.status !== 'errored'
        const restoredTerminal: DevTerminal = {
          ...terminal,
          status: shouldRestart ? 'starting' : terminal.status,
          updatedAt: now,
        }
        this.terminals.set(terminal.id, restoredTerminal)
        if (shouldRestart) terminalsToRestart.push(restoredTerminal)
      }
      this.outputByTerminal = parsed.outputByTerminal ?? {}
      this.persistState()
      for (const terminal of terminalsToRestart) {
        this.startPty(terminal)
      }
    } catch {
      this.terminals.clear()
      this.outputByTerminal = {}
    }
  }

  private persistState(): void {
    const data: PersistedDevTerminals = {
      terminals: this.list(),
      outputByTerminal: this.outputByTerminal,
    }
    writeFileSync(getPersistencePath(), `${JSON.stringify(data, null, 2)}\n`, 'utf8')
  }
}

function getShell(): string {
  return getUserShell()
}

function getPersistencePath(): string {
  return join(app.getPath('userData'), 'orchestrator-dev-terminals.json')
}

export const devTerminalManager = new DevTerminalManager()
