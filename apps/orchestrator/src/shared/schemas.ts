import { z } from 'zod'

export const agentProviderSchema = z.enum(['codex3d', 'claude-code', 'codex', 'opencode', 'shell'])
export const agentRoleSchema = z.enum(['manual', 'planner', 'implementer', 'verifier', 'reviewer', 'tester', 'researcher'])
export const workspaceModeSchema = z.enum(['same-folder', 'new-worktree', 'selected-folder'])

export const launchAgentSchema = z.object({
  provider: agentProviderSchema,
  role: agentRoleSchema,
  cwd: z.string().min(1),
  name: z.string().min(1).optional(),
  workspaceId: z.string().min(1).optional(),
  workspaceMode: workspaceModeSchema,
  binaryPath: z.string().min(1).optional(),
  args: z.array(z.string()).optional(),
})

export const sendInputSchema = z.object({
  sessionId: z.string().min(1),
  input: z.string(),
})

export const resizeSessionSchema = z.object({
  sessionId: z.string().min(1),
  cols: z.number().int().positive(),
  rows: z.number().int().positive(),
})

export const stopSessionSchema = z.object({
  sessionId: z.string().min(1),
})

export const workspaceSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  path: z.string().min(1),
  defaultWorkspaceMode: workspaceModeSchema,
  createdAt: z.number().int().positive(),
  updatedAt: z.number().int().positive(),
})
