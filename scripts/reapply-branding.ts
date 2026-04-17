import { readFileSync, writeFileSync } from 'fs'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'
import { BRANDING_OPERATIONS } from './reapply-branding-spec.ts'

type ApplyResult = {
  operation: string
  filePath: string
  status: 'updated' | 'already-branded'
}

const scriptDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(scriptDir, '..')
const checkOnly = process.argv.includes('--check')

function normalizeLineEndings(content: string): string {
  return content.replace(/\r\n/g, '\n')
}

function applyOperation(fileContents: string, operation: (typeof BRANDING_OPERATIONS)[number]): { nextContents: string; changed: boolean } {
  if (fileContents.includes(operation.branded)) {
    return { nextContents: fileContents, changed: false }
  }

  const matches = fileContents.split(operation.current).length - 1
  if (matches !== 1) {
    throw new Error(
      `${operation.filePath}: expected exactly one match for \"${operation.name}\", found ${matches}`,
    )
  }

  return {
    nextContents: fileContents.replace(operation.current, operation.branded),
    changed: true,
  }
}

const groupedOperations = new Map<string, (typeof BRANDING_OPERATIONS)[]>()
for (const operation of BRANDING_OPERATIONS) {
  const group = groupedOperations.get(operation.filePath) ?? []
  group.push(operation)
  groupedOperations.set(operation.filePath, group)
}

const results: ApplyResult[] = []

for (const [relativeFilePath, operations] of groupedOperations) {
  const absoluteFilePath = resolve(repoRoot, relativeFilePath)
  const originalFileContents = readFileSync(absoluteFilePath, 'utf8')
  const usesCrlf = originalFileContents.includes('\r\n')
  let fileContents = normalizeLineEndings(originalFileContents)
  let fileChanged = false

  for (const operation of operations) {
    const { nextContents, changed } = applyOperation(fileContents, operation)
    fileContents = nextContents
    results.push({
      operation: operation.name,
      filePath: operation.filePath,
      status: changed ? 'updated' : 'already-branded',
    })
    fileChanged ||= changed
  }

  if (fileChanged && !checkOnly) {
    const outputContents = usesCrlf ? fileContents.replace(/\n/g, '\r\n') : fileContents
    writeFileSync(absoluteFilePath, outputContents, 'utf8')
  }
}

const updatedCount = results.filter(result => result.status === 'updated').length
const unchangedCount = results.length - updatedCount
const modeLabel = checkOnly ? 'Check completed' : 'Branding reapply completed'

console.log(`${modeLabel}: ${updatedCount} updated, ${unchangedCount} already branded.`)
for (const result of results) {
  const marker = result.status === 'updated' ? 'updated' : 'ok'
  console.log(`- [${marker}] ${result.filePath} :: ${result.operation}`)
}
