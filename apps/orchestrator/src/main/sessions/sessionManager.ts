import { randomUUID } from 'crypto'
import type { IPty } from 'node-pty'
import { spawn } from 'node-pty'
import type { AgentSession, LaunchAgentInput } from '../../shared/types'
import { getAgentAdapter } from '../agents/registry'

export type SessionOutputHandler = (event: { sessionId: string; chunk: string }) => void
export type SessionStatusHandler = (session: AgentSession) => void

class SessionManager {
  private processes = new Map<string, IPty>()
  private sessionGenerations = new Map<string, number>()
  private stoppingSessions = new Set<string>()
  private sessions = new Map<string, AgentSession>()
  private onOutput?: SessionOutputHandler
  private onStatus?: SessionStatusHandler

  setHandlers(handlers: { onOutput: SessionOutputHandler; onStatus: SessionStatusHandler }): void {
    this.onOutput = handlers.onOutput
    this.onStatus = handlers.onStatus
  }

  list(): AgentSession[] {
    return [...this.sessions.values()]
  }

  launch(input: LaunchAgentInput): AgentSession {
    const adapter = getAgentAdapter(input.provider)
    const launch = adapter.buildLaunchCommand(input)
    const id = randomUUID()
    const now = Date.now()
    const session: AgentSession = {
      id,
      name: input.name ?? `${adapter.displayName} ${input.role}`,
      provider: input.provider,
      role: input.role,
      cwd: launch.cwd,
      command: launch.command,
      args: launch.args,
      status: 'starting',
      createdAt: now,
      updatedAt: now,
    }

    this.sessions.set(id, session)
    this.onStatus?.(session)
    this.startPty(session)

    return this.sessions.get(id)!
  }

  restart(sessionId: string): AgentSession {
    const session = this.sessions.get(sessionId)
    if (!session) {
      throw new Error(`Unknown session: ${sessionId}`)
    }

    const existing = this.processes.get(sessionId)
    if (existing) {
      this.processes.delete(sessionId)
      existing.kill()
    }

    const nextGeneration = (this.sessionGenerations.get(sessionId) ?? 0) + 1
    this.sessionGenerations.set(sessionId, nextGeneration)
    this.stoppingSessions.delete(sessionId)
    this.onOutput?.({ sessionId, chunk: '\r\n[orchestrator] restarting session\r\n' })
    this.updateStatus(sessionId, 'starting')
    this.startPty(this.sessions.get(sessionId)!)
    return this.sessions.get(sessionId)!
  }

  sendInput(sessionId: string, input: string): void {
    const pty = this.processes.get(sessionId)
    if (!pty) {
      this.onOutput?.({ sessionId, chunk: '\r\n[orchestrator] session is not running\r\n' })
      return
    }
    pty.write(input)
  }

  stop(sessionId: string): void {
    const pty = this.processes.get(sessionId)
    if (!pty) return
    this.stoppingSessions.add(sessionId)
    pty.kill()
    this.processes.delete(sessionId)
    this.updateStatus(sessionId, 'stopped')
  }

  resize(sessionId: string, cols: number, rows: number): void {
    const pty = this.processes.get(sessionId)
    if (!pty) return
    pty.resize(cols, rows)
  }

  private startPty(session: AgentSession): void {
    const generation = this.sessionGenerations.get(session.id) ?? 0
    const launch = {
      command: session.command,
      args: session.args,
      cwd: session.cwd,
      env: process.env,
    }
    const terminalCommand = process.platform === 'win32' ? process.env.ComSpec || 'cmd.exe' : launch.command
    const terminalArgs = process.platform === 'win32' ? ['/d', '/k'] : launch.args
    const commandLine = [launch.command, ...launch.args].map(quoteWindowsArg).join(' ')
    const env = Object.fromEntries(
      Object.entries(launch.env).filter((entry): entry is [string, string] => typeof entry[1] === 'string'),
    )

    try {
      const pty = spawn(terminalCommand, terminalArgs, {
        name: process.platform === 'win32' ? 'xterm-256color' : 'xterm-color',
        cols: 100,
        rows: 30,
        cwd: launch.cwd,
        env,
        useConpty: process.platform === 'win32',
      })
      this.processes.set(session.id, pty)
      this.updateStatus(session.id, 'running')
      this.onOutput?.({
        sessionId: session.id,
        chunk: `\r\n[orchestrator] launched ${terminalCommand} ${terminalArgs.join(' ')}\r\n[orchestrator] cwd ${launch.cwd}\r\n`,
      })

      if (process.platform === 'win32') {
        this.onOutput?.({ sessionId: session.id, chunk: `\r\n[orchestrator] running ${commandLine}\r\n` })
        pty.write(`${commandLine}\r`)
      }

      pty.onData(chunk => {
        this.onOutput?.({ sessionId: session.id, chunk })
      })
      pty.onExit(event => {
        const isCurrentProcess = this.processes.get(session.id) === pty
        const isCurrentGeneration = (this.sessionGenerations.get(session.id) ?? 0) === generation
        if (!isCurrentProcess || !isCurrentGeneration) return

        this.onOutput?.({ sessionId: session.id, chunk: `\r\n[orchestrator] exited with code ${event.exitCode}\r\n` })
        this.processes.delete(session.id)
        const wasStoppedByUser = this.stoppingSessions.delete(session.id)
        this.updateStatus(session.id, wasStoppedByUser || event.exitCode === 0 ? 'stopped' : 'errored')
      })
    } catch (error) {
      this.onOutput?.({ sessionId: session.id, chunk: `\r\n[orchestrator] ${error instanceof Error ? error.message : 'Failed to launch session'}\r\n` })
      this.updateStatus(session.id, 'errored')
    }
  }

  private updateStatus(sessionId: string, status: AgentSession['status']): void {
    const current = this.sessions.get(sessionId)
    if (!current) return
    const next = { ...current, status, updatedAt: Date.now() }
    this.sessions.set(sessionId, next)
    this.onStatus?.(next)
  }
}

function quoteWindowsArg(arg: string): string {
  if (!/[\s&()^[\]{}=;!'+,`~]/.test(arg)) return arg
  return `"${arg.replace(/"/g, '\\"')}"`
}

export const sessionManager = new SessionManager()
