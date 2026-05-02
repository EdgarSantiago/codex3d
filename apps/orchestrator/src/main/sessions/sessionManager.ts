import { randomUUID } from 'crypto'
import { app } from 'electron'
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'fs'
import { homedir } from 'os'
import { join } from 'path'
import type { IPty } from 'node-pty'
import { spawn } from 'node-pty'
import type { AgentSession, LaunchAgentInput, SessionCompletionCounts } from '../../shared/types'
import { getAgentAdapter } from '../agents/registry'
import { buildPtyLaunch, describeCwd, getSafeCwd, getTerminalEnv } from '../platform/terminal'

export type SessionOutputHandler = (event: { sessionId: string; chunk: string }) => void
export type SessionStatusHandler = (session: AgentSession) => void

type PersistedSessions = {
  sessions: AgentSession[]
  outputBySession: Record<string, string>
  completedPromptCounts?: SessionCompletionCounts
}

const MAX_PERSISTED_OUTPUT_CHARS = 1024 * 1024

class SessionManager {
  private processes = new Map<string, IPty>()
  private sessionGenerations = new Map<string, number>()
  private stoppingSessions = new Set<string>()
  private sessions = new Map<string, AgentSession>()
  private outputBySession: Record<string, string> = {}
  private completedPromptCounts: SessionCompletionCounts = {}
  private pendingPromptCounts: SessionCompletionCounts = {}
  private pendingPromptAssistantBaselineBySession: SessionCompletionCounts = {}
  private inputBySession: Record<string, string> = {}
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

  completionCounts(): SessionCompletionCounts {
    return { ...this.completedPromptCounts }
  }

  clearCompletionCounts(sessionIds: string[]): SessionCompletionCounts {
    for (const sessionId of sessionIds) {
      this.completedPromptCounts[sessionId] = 0
    }
    this.persistState()
    return this.completionCounts()
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

    const nextGeneration = (this.sessionGenerations.get(sessionId) ?? 0) + 1
    this.sessionGenerations.set(sessionId, nextGeneration)

    const existing = this.processes.get(sessionId)
    if (existing) {
      this.processes.delete(sessionId)
      existing.kill()
    }

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
    delete this.completedPromptCounts[sessionId]
    delete this.pendingPromptCounts[sessionId]
    delete this.inputBySession[sessionId]
    delete this.pendingPromptAssistantBaselineBySession[sessionId]
    this.persistState()
  }

  sendInput(sessionId: string, input: string): void {
    const pty = this.processes.get(sessionId)
    if (!pty) {
      this.appendOutput(sessionId, '\r\n[orchestrator] session is not running\r\n')
      return
    }
    const session = this.sessions.get(sessionId)
    if (session?.provider === 'codex3d') this.trackSubmittedPrompts(sessionId, input)
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
    const ptyLaunch = buildPtyLaunch(session.command, args)
    const env = getTerminalEnv()
    const cwd = getSafeCwd(session.cwd)

    try {
      const pty = spawn(ptyLaunch.command, ptyLaunch.args, {
        name: 'xterm-256color',
        cols: 100,
        rows: 30,
        cwd,
        env,
        useConpty: process.platform === 'win32',
      })
      this.processes.set(session.id, pty)
      this.updateStatus(session.id, 'running')
      this.appendOutput(
        session.id,
        `\r\n[orchestrator] launched ${ptyLaunch.command} ${ptyLaunch.args.join(' ')}\r\n[orchestrator] cwd ${cwd}\r\n`,
      )

      if (ptyLaunch.input) {
        this.appendOutput(session.id, `\r\n[orchestrator] running ${ptyLaunch.display}\r\n`)
        pty.write(ptyLaunch.input)
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
      this.appendOutput(session.id, `\r\n[orchestrator] ${error instanceof Error ? error.message : 'Failed to launch session'}\r\n[orchestrator] command ${ptyLaunch.command} ${ptyLaunch.args.join(' ')}\r\n[orchestrator] cwd ${session.cwd} (${describeCwd(session.cwd)})\r\n[orchestrator] fallback cwd ${cwd}\r\n`)
      this.updateStatus(session.id, 'errored')
    }
  }

  private trackSubmittedPrompts(sessionId: string, input: string): void {
    const previous = this.inputBySession[sessionId] ?? ''
    const next = `${previous}${input}`
    const submittedPrompts = next.split(/\r\n|\r|\n/)
    const pendingInput = submittedPrompts.pop() ?? ''
    const count = submittedPrompts.filter(prompt => prompt.trim()).length
    if (count > 0) {
      const session = this.sessions.get(sessionId)
      this.pendingPromptCounts[sessionId] = (this.pendingPromptCounts[sessionId] ?? 0) + count
      this.pendingPromptAssistantBaselineBySession[sessionId] = session ? countAssistantMessages(session) : 0
    }
    this.inputBySession[sessionId] = pendingInput
  }

  private trackCompletedPrompts(sessionId: string, chunk: string): void {
    const pendingCount = this.pendingPromptCounts[sessionId] ?? 0
    if (pendingCount <= 0 || !isCodex3DReadyPrompt(chunk)) return
    const session = this.sessions.get(sessionId)
    if (!session) return
    const assistantDelta = countAssistantMessages(session) - (this.pendingPromptAssistantBaselineBySession[sessionId] ?? 0)
    const completedCount = Math.min(pendingCount, Math.max(0, assistantDelta))
    if (completedCount <= 0) return
    this.completedPromptCounts[sessionId] = (this.completedPromptCounts[sessionId] ?? 0) + completedCount
    const remainingPendingCount = pendingCount - completedCount
    if (remainingPendingCount > 0) {
      this.pendingPromptCounts[sessionId] = remainingPendingCount
      this.pendingPromptAssistantBaselineBySession[sessionId] = countAssistantMessages(session)
    } else {
      delete this.pendingPromptCounts[sessionId]
      delete this.pendingPromptAssistantBaselineBySession[sessionId]
    }
    this.persistState()
  }

  private appendOutput(sessionId: string, chunk: string): void {
    const session = this.sessions.get(sessionId)
    if (session?.provider === 'codex3d') this.trackCompletedPrompts(sessionId, chunk)
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
      this.completedPromptCounts = parsed.completedPromptCounts ?? Object.fromEntries(this.list().map(session => [session.id, countCompletedPrompts(session)]))
      this.persistState()
    } catch {
      this.sessions.clear()
      this.outputBySession = {}
      this.completedPromptCounts = {}
    }
  }

  private persistState(): void {
    const data: PersistedSessions = {
      sessions: this.list(),
      outputBySession: this.outputBySession,
      completedPromptCounts: this.completedPromptCounts,
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

function countAssistantMessages(session: AgentSession): number {
  if (session.provider !== 'codex3d') return 0
  const transcriptPath = getCodex3DTranscriptPath(session.cwd, session.id)
  if (existsSync(transcriptPath)) return countAssistantMessagesInFile(transcriptPath)
  return countAssistantMessagesInLegacyDirectory(session.id)
}

function countAssistantMessagesInLegacyDirectory(sessionId: string): number {
  const projectsDir = getCodex3DProjectsDir()
  if (!existsSync(projectsDir)) return 0
  try {
    for (const projectName of readdirSync(projectsDir)) {
      const transcriptPath = join(projectsDir, projectName, `${sessionId}.jsonl`)
      if (existsSync(transcriptPath)) return countAssistantMessagesInFile(transcriptPath)
    }
  } catch {
    return 0
  }
  return 0
}

function countAssistantMessagesInFile(path: string): number {
  try {
    return readFileSync(path, 'utf8')
      .split('\n')
      .filter(line => line.includes('"type":"assistant"') || line.includes('"type": "assistant"'))
      .length
  } catch {
    return 0
  }
}

function isCodex3DReadyPrompt(chunk: string): boolean {
  return normalizeTerminalText(stripAnsi(chunk))
    .split(/\r\n|\r|\n/)
    .some(line => /^\s*❯\s*$/.test(line))
}

function normalizeTerminalText(input: string): string {
  return input.replace(/[^\t\n\r\x20-\x7e❯]/g, '')
}

function stripAnsi(input: string): string {
  return input.replace(/\u001b\[[0-?]*[ -/]*[@-~]/g, '')
}

function countCompletedPrompts(session: AgentSession): number {
  if (session.provider !== 'codex3d') return 0
  const transcriptPath = getCodex3DTranscriptPath(session.cwd, session.id)
  if (existsSync(transcriptPath)) return countCompletedPromptsInFile(transcriptPath)
  return countCompletedPromptsInLegacyDirectory(session.id)
}

function countCompletedPromptsInLegacyDirectory(sessionId: string): number {
  const projectsDir = getCodex3DProjectsDir()
  if (!existsSync(projectsDir)) return 0
  try {
    for (const projectName of readdirSync(projectsDir)) {
      const transcriptPath = join(projectsDir, projectName, `${sessionId}.jsonl`)
      if (existsSync(transcriptPath)) return countCompletedPromptsInFile(transcriptPath)
    }
  } catch {
    return 0
  }
  return 0
}

function countCompletedPromptsInFile(path: string): number {
  try {
    return readFileSync(path, 'utf8')
      .split('\n')
      .filter(line => line.includes('"type":"last-prompt"'))
      .length
  } catch {
    return 0
  }
}

function getPersistencePath(): string {
  return join(app.getPath('userData'), 'orchestrator-sessions.json')
}

export const sessionManager = new SessionManager()
