import type { LaunchAgentInput, ProviderDetectionResult } from '../../shared/types'
import type { AgentAdapter, LaunchCommand } from './AgentAdapter'
import { detectBinary } from './detectBinary'

export const codexAdapter: AgentAdapter = {
  id: 'codex',
  displayName: 'Codex',

  async detect(): Promise<ProviderDetectionResult> {
    const binaryPath = 'codex'
    const result = await detectBinary(binaryPath)
    return {
      provider: 'codex',
      found: !result.error,
      binaryPath: result.error ? undefined : binaryPath,
      version: result.version,
      error: result.error,
    }
  },

  buildLaunchCommand(input: LaunchAgentInput): LaunchCommand {
    return {
      command: input.binaryPath ?? 'codex',
      args: input.args ?? [],
      cwd: input.cwd,
      env: process.env,
    }
  },

  formatPrompt(prompt: string): string {
    return `${prompt}\n`
  },

  supports: {
    worktrees: true,
    slashCommands: true,
    structuredEvents: false,
    backgroundJobs: true,
    permissions: true,
  },
}
