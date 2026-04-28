import type { AgentAdapter } from './AgentAdapter'
import { codex3dAdapter } from './codex3d'

const adapters = new Map<string, AgentAdapter>([
  [codex3dAdapter.id, codex3dAdapter],
])

export function getAgentAdapter(provider: string): AgentAdapter {
  const adapter = adapters.get(provider)
  if (!adapter) {
    throw new Error(`Unsupported agent provider: ${provider}`)
  }
  return adapter
}

export function listAgentAdapters(): AgentAdapter[] {
  return [...adapters.values()]
}
