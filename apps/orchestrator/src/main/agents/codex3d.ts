import { execFile } from 'child_process'
import { promisify } from 'util'
import type { LaunchAgentInput, ProviderDetectionResult } from '../../shared/types'
import type { AgentAdapter, LaunchCommand } from './AgentAdapter'

const execFileAsync = promisify(execFile)

async function detectBinary(binaryPath: string): Promise<{ version?: string; error?: string }> {
  try {
    const { stdout, stderr } = await execFileAsync(binaryPath, ['--version'], {
      timeout: 5000,
      windowsHide: true,
    })
    return { version: (stdout || stderr).trim() || undefined }
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Unknown detection error' }
  }
}

export const codex3dAdapter: AgentAdapter = {
  id: 'codex3d',
  displayName: 'Codex3D',

  async detect(): Promise<ProviderDetectionResult> {
    const binaryPath = 'codex3d'
    const result = await detectBinary(binaryPath)
    return {
      provider: 'codex3d',
      found: !result.error,
      binaryPath: result.error ? undefined : binaryPath,
      version: result.version,
      error: result.error,
    }
  },

  buildLaunchCommand(input: LaunchAgentInput): LaunchCommand {
    return {
      command: input.binaryPath ?? 'codex3d',
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
