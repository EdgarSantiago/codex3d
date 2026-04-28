import { readdir, readFile, stat } from 'fs/promises'
import { homedir } from 'os'
import { basename, join } from 'path'
import type { LocalSkill } from '../../shared/types'

const MAX_SKILL_README_BYTES = 64 * 1024

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

async function readSkill(skillPath: string): Promise<LocalSkill | undefined> {
  const skillStat = await stat(skillPath)
  if (!skillStat.isDirectory()) return undefined

  const id = basename(skillPath)
  const readmePath = join(skillPath, 'README.md')
  let name = id
  let description = 'Local Claude skill'
  let hasReadme = false

  try {
    const readmeStat = await stat(readmePath)
    if (readmeStat.isFile() && readmeStat.size <= MAX_SKILL_README_BYTES) {
      hasReadme = true
      const frontmatter = parseFrontmatter(await readFile(readmePath, 'utf-8'))
      name = frontmatter.name || id
      description = frontmatter.description || description
    }
  } catch {
    // Skills can exist without a README; show the folder name.
  }

  return {
    id,
    name,
    description,
    path: skillPath,
    source: 'claude-user',
    hasReadme,
  }
}

export async function listLocalClaudeSkills(): Promise<LocalSkill[]> {
  const skillsRoot = join(homedir(), '.claude', 'skills')
  let entries: string[]
  try {
    entries = await readdir(skillsRoot)
  } catch {
    return []
  }

  const skills = await Promise.all(entries.map(entry => readSkill(join(skillsRoot, entry))))
  return skills
    .filter((skill): skill is LocalSkill => skill !== undefined)
    .sort((a, b) => a.name.localeCompare(b.name))
}
