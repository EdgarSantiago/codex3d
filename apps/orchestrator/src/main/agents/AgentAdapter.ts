import type { AgentProvider, LaunchAgentInput, ProviderDetectionResult } from '../../shared/types'

export type LaunchCommand = {
  command: string
  args: string[]
  cwd: string
  env: NodeJS.ProcessEnv
}

export type AgentAdapter = {
  id: AgentProvider
  displayName: string
  detect(): Promise<ProviderDetectionResult>
  buildLaunchCommand(input: LaunchAgentInput): LaunchCommand
  formatPrompt(prompt: string): string
  supports: {
    worktrees: boolean
    slashCommands: boolean
    structuredEvents: boolean
    backgroundJobs: boolean
    permissions: boolean
  }
}
