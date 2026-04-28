import { readdir, readFile, stat } from 'fs/promises'
import { homedir } from 'os'
import { basename, extname, join } from 'path'
import type { LocalAgent } from '../../shared/types'

const MAX_AGENT_BYTES = 128 * 1024

function parseFrontmatter(content: string): { name?: string; description?: string } {
  if (!content.startsWith('---')) return {}
  const end = content.indexOf('\n---', 3)
  if (end === -1) return {}

  const frontmatter = content.slice(3, end).trim()
  const result: { name?: string; description?: string } = {}
  for (const line of frontmatter.split(/\r?\n/)) {
    const separator = line.indexOf(':')
    if (separator === -1) continue
    const key = line.slice(0, separator).trim()
    const value = line.slice(separator + 1).trim().replace(/^['"]|['"]$/g, '')
    if (key === 'name') result.name = value
    if (key === 'description') result.description = value
  }
  return result
}

function prettifyAgentName(fileName: string): string {
  return basename(fileName, extname(fileName))
    .replace(/^gsd-/, '')
    .split('-')
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

async function readAgent(agentPath: string): Promise<LocalAgent | undefined> {
  const agentStat = await stat(agentPath)
  if (!agentStat.isFile() || agentStat.size > MAX_AGENT_BYTES || extname(agentPath) !== '.md') {
    return undefined
  }

  const fileName = basename(agentPath)
  const id = basename(fileName, '.md')
  const content = await readFile(agentPath, 'utf-8')
  const frontmatter = parseFrontmatter(content)

  return {
    id,
    name: frontmatter.name || prettifyAgentName(fileName),
    description: frontmatter.description || 'Local Claude agent',
    path: agentPath,
    source: 'claude-user',
  }
}

export async function listLocalClaudeAgents(): Promise<LocalAgent[]> {
  const agentsRoot = join(homedir(), '.claude', 'agents')
  let entries: string[]
  try {
    entries = await readdir(agentsRoot)
  } catch {
    return []
  }

  const agents = await Promise.all(entries.map(entry => readAgent(join(agentsRoot, entry))))
  return agents
    .filter((agent): agent is LocalAgent => agent !== undefined)
    .sort((a, b) => a.name.localeCompare(b.name))
}
