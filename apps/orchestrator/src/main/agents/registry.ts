import type { AgentAdapter } from './AgentAdapter'
import { codexAdapter } from './codex'
import { codex3dAdapter } from './codex3d'
import { opencodeAdapter } from './opencode'

const adapters = new Map<string, AgentAdapter>([
  [codex3dAdapter.id, codex3dAdapter],
  [codexAdapter.id, codexAdapter],
  [opencodeAdapter.id, opencodeAdapter],
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
