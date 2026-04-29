import { randomUUID } from 'crypto'
import { app } from 'electron'
import { existsSync, readFileSync, writeFileSync } from 'fs'
import { homedir } from 'os'
import { join } from 'path'
import type { IPty } from 'node-pty'
import { spawn } from 'node-pty'
import type { AgentSession, LaunchAgentInput } from '../../shared/types'
import { getAgentAdapter } from '../agents/registry'

export type SessionOutputHandler = (event: { sessionId: string; chunk: string }) => void
export type SessionStatusHandler = (session: AgentSession) => void

type PersistedSessions = {
  sessions: AgentSession[]
  outputBySession: Record<string, string>
}

const MAX_PERSISTED_OUTPUT_CHARS = 1024 * 1024

class SessionManager {
  private processes = new Map<string, IPty>()
  private sessionGenerations = new Map<string, number>()
  private stoppingSessions = new Set<string>()
  private sessions = new Map<string, AgentSession>()
  private outputBySession: Record<string, string> = {}
  private onOutput?: SessionOutputHandler
  private onStatus?: SessionStatusHandler

  constructor() {
    this.loadPersistedState()
  }

  setHandlers(handlers: { onOutput: SessionOutputHandler; onStatus: SessionStatusHandler }): void {
    this.onOutput = handlers.onOutput
    this.onStatus = handlers.onStatus
  }

  list(): AgentSession[] {
    return [...this.sessions.values()]
  }

  outputs(): Record<string, string> {
    return { ...this.outputBySession }
  }

  launch(input: LaunchAgentInput): AgentSession {
    const adapter = getAgentAdapter(input.provider)
    const launch = adapter.buildLaunchCommand(input)
    const id = randomUUID()
    const args = buildInitialArgs(input.provider, id, launch.args)
    const now = Date.now()
    const session: AgentSession = {
      id,
      workspaceId: input.workspaceId,
      name: input.name ?? `${adapter.displayName} ${input.role}`,
      provider: input.provider,
      role: input.role,
      cwd: launch.cwd,
      command: launch.command,
      args,
      resumeArgs: input.provider === 'codex3d' ? ['--resume', id] : undefined,
      status: 'starting',
      createdAt: now,
      updatedAt: now,
    }

    this.sessions.set(id, session)
    this.persistState()
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
    const isResume = Boolean(session.resumeArgs)
    this.appendOutput(sessionId, `\r\n[orchestrator] ${isResume ? 'resuming' : 'restarting'} session\r\n`)
    this.updateStatus(sessionId, 'starting')
    this.startPty(this.sessions.get(sessionId)!, true)
    return this.sessions.get(sessionId)!
  }

  rename(sessionId: string, name: string): AgentSession {
    const current = this.sessions.get(sessionId)
    if (!current) {
      throw new Error(`Unknown session: ${sessionId}`)
    }
    const next = { ...current, name, updatedAt: Date.now() }
    this.sessions.set(sessionId, next)
    this.persistState()
    this.onStatus?.(next)
    return next
  }

  remove(sessionId: string): void {
    this.stop(sessionId)
    this.sessions.delete(sessionId)
    delete this.outputBySession[sessionId]
    this.persistState()
  }

  sendInput(sessionId: string, input: string): void {
    const pty = this.processes.get(sessionId)
    if (!pty) {
      this.appendOutput(sessionId, '\r\n[orchestrator] session is not running\r\n')
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

  private startPty(session: AgentSession, useResumeArgs = false): void {
    const generation = this.sessionGenerations.get(session.id) ?? 0
    const args = useResumeArgs && session.resumeArgs ? session.resumeArgs : session.args
    const launch = {
      command: session.command,
      args,
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
      this.appendOutput(
        session.id,
        `\r\n[orchestrator] launched ${terminalCommand} ${terminalArgs.join(' ')}\r\n[orchestrator] cwd ${launch.cwd}\r\n`,
      )

      if (process.platform === 'win32') {
        this.appendOutput(session.id, `\r\n[orchestrator] running ${commandLine}\r\n`)
        pty.write(`${commandLine}\r`)
      }

      pty.onData(chunk => this.appendOutput(session.id, chunk))
      pty.onExit(event => {
        const isCurrentProcess = this.processes.get(session.id) === pty
        const isCurrentGeneration = (this.sessionGenerations.get(session.id) ?? 0) === generation
        if (!isCurrentProcess || !isCurrentGeneration) return

        this.appendOutput(session.id, `\r\n[orchestrator] exited with code ${event.exitCode}\r\n`)
        this.processes.delete(session.id)
        const wasStoppedByUser = this.stoppingSessions.delete(session.id)
        this.updateStatus(session.id, wasStoppedByUser || event.exitCode === 0 ? 'stopped' : 'errored')
      })
    } catch (error) {
      this.appendOutput(session.id, `\r\n[orchestrator] ${error instanceof Error ? error.message : 'Failed to launch session'}\r\n`)
      this.updateStatus(session.id, 'errored')
    }
  }

  private appendOutput(sessionId: string, chunk: string): void {
    const nextOutput = `${this.outputBySession[sessionId] ?? ''}${chunk}`
    this.outputBySession[sessionId] = nextOutput.slice(-MAX_PERSISTED_OUTPUT_CHARS)
    this.persistState()
    this.onOutput?.({ sessionId, chunk })
  }

  private updateStatus(sessionId: string, status: AgentSession['status']): void {
    const current = this.sessions.get(sessionId)
    if (!current) return
    const next = { ...current, status, updatedAt: Date.now() }
    this.sessions.set(sessionId, next)
    this.persistState()
    this.onStatus?.(next)
  }

  private loadPersistedState(): void {
    const path = getPersistencePath()
    if (!existsSync(path)) return
    try {
      const parsed = JSON.parse(readFileSync(path, 'utf8')) as PersistedSessions
      const now = Date.now()
      for (const session of parsed.sessions ?? []) {
        const resumeArgs = hasCodex3DTranscript(session) ? session.resumeArgs : undefined
        this.sessions.set(session.id, {
          ...session,
          resumeArgs,
          status: 'stopped',
          updatedAt: now,
        })
      }
      this.outputBySession = parsed.outputBySession ?? {}
      this.persistState()
    } catch {
      this.sessions.clear()
      this.outputBySession = {}
    }
  }

  private persistState(): void {
    const data: PersistedSessions = {
      sessions: this.list(),
      outputBySession: this.outputBySession,
    }
    writeFileSync(getPersistencePath(), `${JSON.stringify(data, null, 2)}\n`, 'utf8')
  }
}

function buildInitialArgs(provider: AgentSession['provider'], sessionId: string, args: string[]): string[] {
  if (provider !== 'codex3d') return args
  return ['--session-id', sessionId, ...stripSessionIdentityArgs(args)]
}

function stripSessionIdentityArgs(args: string[]): string[] {
  const stripped: string[] = []
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]
    if (arg === '--session-id' || arg === '--resume') {
      index += 1
      continue
    }
    if (arg.startsWith('--session-id=') || arg.startsWith('--resume=')) continue
    stripped.push(arg)
  }
  return stripped
}

function hasCodex3DTranscript(session: AgentSession): boolean {
  if (session.provider !== 'codex3d' || !session.resumeArgs) return false
  return existsSync(getCodex3DTranscriptPath(session.cwd, session.id))
}

function getCodex3DTranscriptPath(cwd: string, sessionId: string): string {
  return join(getCodex3DProjectsDir(), sanitizePath(cwd), `${sessionId}.jsonl`)
}

function getCodex3DProjectsDir(): string {
  return join(getCodex3DConfigHomeDir(), 'projects')
}

function getCodex3DConfigHomeDir(): string {
  if (process.env.CLAUDE_CONFIG_DIR) return process.env.CLAUDE_CONFIG_DIR.normalize('NFC')
  const homeDir = homedir()
  const openClaudeDir = join(homeDir, '.openclaude')
  const legacyClaudeDir = join(homeDir, '.claude')
  if (!existsSync(openClaudeDir) && existsSync(legacyClaudeDir)) return legacyClaudeDir.normalize('NFC')
  return openClaudeDir.normalize('NFC')
}

function sanitizePath(name: string): string {
  const sanitized = name.replace(/[^a-zA-Z0-9]/g, '-')
  if (sanitized.length <= 200) return sanitized
  return `${sanitized.slice(0, 200)}-${simpleHash(name)}`
}

function simpleHash(input: string): string {
  let hash = 5381
  for (let index = 0; index < input.length; index += 1) {
    hash = (hash * 33) ^ input.charCodeAt(index)
  }
  return (hash >>> 0).toString(36)
}

function getPersistencePath(): string {
  return join(app.getPath('userData'), 'orchestrator-sessions.json')
}

function quoteWindowsArg(arg: string): string {
  if (!/[\s&()^[\]{}=;!'+,`~]/.test(arg)) return arg
  return `"${arg.replace(/"/g, '\\"')}"`
}

export const sessionManager = new SessionManager()
