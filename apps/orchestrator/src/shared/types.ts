export type AgentProvider = 'codex3d' | 'claude-code' | 'codex' | 'opencode' | 'shell'

export type AgentStatus = 'starting' | 'idle' | 'running' | 'waiting' | 'errored' | 'stopped'

export type WorkspaceMode = 'same-folder' | 'new-worktree' | 'selected-folder'

export type AgentRole = 'manual' | 'planner' | 'implementer' | 'verifier' | 'reviewer' | 'tester' | 'researcher'

export type AgentSession = {
  id: string
  workspaceId?: string
  name: string
  provider: AgentProvider
  role: AgentRole
  cwd: string
  command: string
  args: string[]
  status: AgentStatus
  createdAt: number
  updatedAt: number
}

export type LaunchAgentInput = {
  provider: AgentProvider
  role: AgentRole
  cwd: string
  name?: string
  workspaceId?: string
  workspaceMode: WorkspaceMode
  binaryPath?: string
  args?: string[]
}

export type Workspace = {
  id: string
  name: string
  path: string
  defaultWorkspaceMode: WorkspaceMode
  createdAt: number
  updatedAt: number
}

export type ProviderDetectionResult = {
  provider: AgentProvider
  found: boolean
  binaryPath?: string
  version?: string
  error?: string
}

export type AgentPreset = {
  id: string
  name: string
  provider: AgentProvider
  role: AgentRole
  workspaceMode: WorkspaceMode
  startupPrompt?: string
  allowedSkillIds: string[]
}

export type LocalAgent = {
  id: string
  name: string
  description: string
  path: string
  source: 'claude-user'
}

export type LocalSkill = {
  id: string
  name: string
  description: string
  path: string
  source: 'claude-user'
  hasReadme: boolean
}
