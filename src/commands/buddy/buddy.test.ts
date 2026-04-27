import { afterEach, beforeEach, expect, mock, test } from 'bun:test'
import * as actualCrypto from 'crypto'
import { mkdir, readFile, rm, writeFile } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'

import type { StoredCompanion } from '../../buddy/types.js'
import type { LocalJSXCommandContext, LocalJSXCommandOnDone } from '../../types/command.js'

type MockConfig = {
  companion?: StoredCompanion
  companionMuted?: boolean
  companionMode?: 'minimal' | 'balanced' | 'expressive'
  userID?: string
}

let mockConfig: MockConfig = { userID: 'user-1' }
let uuidCounter = 0
let mockCwd = process.cwd()

function installBuddyMocks() {
  const configMock = {
    getGlobalConfig: () => mockConfig,
    saveGlobalConfig: (updater: (current: MockConfig) => MockConfig) => {
      mockConfig = updater(mockConfig)
    },
  }
  mock.module('../../utils/config.js', () => configMock)
  mock.module('../../utils/config.ts', () => configMock)

  const cwdMock = { getCwd: () => mockCwd }
  mock.module('../../utils/cwd.js', () => cwdMock)
  mock.module('../../utils/cwd.ts', () => cwdMock)

  const cryptoMock = () => ({
    ...actualCrypto,
    randomUUID: () => `uuid-${++uuidCounter}`,
  })
  mock.module('crypto', cryptoMock)
  mock.module('node:crypto', cryptoMock)
}

async function importFreshBuddyModule() {
  return import(`./buddy.tsx?ts=${Date.now()}-${Math.random()}`)
}

function createContext() {
  let appState = {} as Record<string, unknown>
  return {
    context: {
      setAppState: (updater: (prev: Record<string, unknown>) => Record<string, unknown>) => {
        appState = updater(appState as never) as Record<string, unknown>
        return appState as never
      },
    } as unknown as LocalJSXCommandContext,
    getAppState: () => appState,
  }
}

beforeEach(() => {
  mockConfig = { userID: 'user-1' }
  uuidCounter = 0
  mockCwd = process.cwd()
})

function createOnDoneSpy() {
  const calls: Array<{
    result?: string
    options?: Parameters<LocalJSXCommandOnDone>[1]
  }> = []

  const onDone: LocalJSXCommandOnDone = (result, options) => {
    calls.push({ result, options })
  }

  return { onDone, calls }
}

afterEach(() => {
  mock.restore()
})

test('hatch and status use the same reconstructed buddy', async () => {
  installBuddyMocks()
  const buddyModule = await importFreshBuddyModule()
  const first = createOnDoneSpy()

  const firstContext = createContext()
  await buddyModule.call(first.onDone, firstContext.context)

  expect(mockConfig.companion?.seed).toMatch(/^user-1:uuid-\d+$/)
  expect(mockConfig.companionMuted).toBe(false)
  expect(mockConfig.companion?.progress).toEqual({
    xpTotal: 0,
    promptTurns: 0,
    productiveTurns: 0,
    workDurationMs: 0,
    errorFeeds: 0,
    currentStreak: 0,
    bestStreak: 0,
    currentCombo: 0,
    bestCombo: 0,
    highestStatMilestone: 0,
    statBonuses: undefined,
    lastPromptAt: undefined,
    lastWorkAt: undefined,
    lastComboAt: undefined,
    lastStreakDay: undefined,
    recentPromptTurnAts: [],
    recentWorkAts: [],
    recentErrorFeedKeys: [],
    version: 4,
  })
  expect(first.calls[0]?.result).toContain('is now your buddy')

  const second = createOnDoneSpy()
  await buddyModule.call(second.onDone, createContext().context, 'status')

  expect(second.calls[0]?.result).toContain((mockConfig.companion?.name ?? '').toUpperCase())
  expect(second.calls[0]?.result).toContain(mockConfig.companion?.personality.replace(/\.$/, '') ?? '')
  expect(second.calls[0]?.result).toContain('LVL')
  expect(second.calls[0]?.result).toContain('XP')
  expect(second.calls[0]?.result).toContain('PROMPTS')
  expect(second.calls[0]?.result).toContain('PRODUCTIVE')
  expect(second.calls[0]?.result).toContain('ACHIEVEMENTS')
  expect(second.calls[0]?.result).not.toContain('PRODUCTI…')
  expect(second.calls[0]?.result).not.toContain('ACHIEVEM…')
  expect(second.calls[0]?.result).not.toContain('Excit…')
  expect(second.calls[0]?.result).not.toContain('Lonely…')
  expect(second.calls[0]?.result).toContain('0/20 · 20 LEFT')
  expect(second.calls[0]?.result).toContain('BADGES')
  expect(second.calls[0]?.result).not.toContain('NOTE')
})

test('status shows dynamic trait tones and optional note stays hidden by default', async () => {
  mockConfig = {
    userID: 'user-1',
    companion: {
      seed: 'seed-1',
      name: 'Bytedot',
      personality: 'Curious and quietly encouraging.',
      hatchedAt: 1,
      progress: {
        xpTotal: 2076,
        promptTurns: 129,
        productiveTurns: 91,
        workDurationMs: 104 * 60 * 1000,
        errorFeeds: 52,
        currentStreak: 3,
        bestStreak: 3,
        currentCombo: 14,
        bestCombo: 14,
        highestStatMilestone: 0,
        statBonuses: undefined,
        lastPromptAt: undefined,
        lastWorkAt: 1,
        lastComboAt: 1,
        lastStreakDay: 1,
        recentPromptTurnAts: [],
        recentWorkAts: [],
        recentErrorFeedKeys: [],
        version: 4,
      },
    },
  }
  installBuddyMocks()
  const buddyModule = await importFreshBuddyModule()
  const done = createOnDoneSpy()

  await buddyModule.call(done.onDone, createContext().context, 'status')

  expect(done.calls[0]?.result).toContain('DEBUGGING')
  expect(done.calls[0]?.result).toContain('BALANCED')
  expect(done.calls[0]?.result).toContain('CHAOS')
  expect(done.calls[0]?.result).toContain('SPICY')
  expect(done.calls[0]?.result).toContain('WISDOM')
  expect(done.calls[0]?.result).toContain('QUIET')
  expect(done.calls[0]?.result).not.toContain('NOTE')
})



test('export writes buddy data to the requested path and refuses overwrite', async () => {
  const tempDir = join(tmpdir(), `buddy-export-${Date.now()}-${Math.random()}`)
  await mkdir(tempDir, { recursive: true })
  mockCwd = tempDir
  mockConfig = {
    companion: {
      seed: 'seed-1',
      name: 'Runebit',
      personality: 'Patient watcher.',
      hatchedAt: 123,
    },
    companionMuted: true,
    companionMode: 'minimal',
  }
  installBuddyMocks()
  const buddyModule = await importFreshBuddyModule()
  const outputPath = join(tempDir, 'runebit.json')
  const first = createOnDoneSpy()

  await buddyModule.call(first.onDone, createContext().context, `export ${outputPath}`)

  expect(first.calls[0]?.result).toContain(`Buddy exported to: ${outputPath}`)
  const exported = JSON.parse(await readFile(outputPath, 'utf-8'))
  expect(exported.companion.name).toBe('Runebit')
  expect(exported.companionMuted).toBe(true)
  expect(exported.companionMode).toBe('minimal')
  expect(exported.userID).toBeUndefined()

  const second = createOnDoneSpy()
  await buddyModule.call(second.onDone, createContext().context, `export ${outputPath}`)
  expect(second.calls[0]?.result).toContain('Refusing to overwrite existing file')

  await rm(tempDir, { recursive: true, force: true })
})

test('import refuses to overwrite an existing buddy without replace', async () => {
  const tempDir = join(tmpdir(), `buddy-import-refuse-${Date.now()}-${Math.random()}`)
  await mkdir(tempDir, { recursive: true })
  mockCwd = tempDir
  const inputPath = join(tempDir, 'runebit.json')
  await writeFile(inputPath, JSON.stringify({
    format: 'codex3d.buddy.export',
    version: 1,
    exportedAt: 456,
    companion: {
      seed: 'new-seed',
      name: 'Runebit',
      personality: 'Patient watcher.',
      hatchedAt: 123,
    },
  }))
  mockConfig = {
    companion: {
      seed: 'old-seed',
      name: 'OldPal',
      personality: 'Already here.',
      hatchedAt: 1,
    },
  }
  installBuddyMocks()
  const buddyModule = await importFreshBuddyModule()
  const done = createOnDoneSpy()

  await buddyModule.call(done.onDone, createContext().context, `import ${inputPath}`)

  expect(mockConfig.companion?.name).toBe('OldPal')
  expect(done.calls[0]?.result).toContain('A buddy already exists')
  expect(done.calls[0]?.result).toContain('Rerun with --replace')

  await rm(tempDir, { recursive: true, force: true })
})

test('import replaces the existing buddy when replace is explicit', async () => {
  const tempDir = join(tmpdir(), `buddy-import-replace-${Date.now()}-${Math.random()}`)
  await mkdir(tempDir, { recursive: true })
  mockCwd = tempDir
  const inputPath = join(tempDir, 'runebit.json')
  await writeFile(inputPath, JSON.stringify({
    format: 'codex3d.buddy.export',
    version: 1,
    exportedAt: 456,
    companion: {
      seed: 'new-seed',
      name: 'Runebit',
      personality: 'Patient watcher.',
      hatchedAt: 123,
    },
    companionMuted: false,
    companionMode: 'expressive',
  }))
  mockConfig = {
    companion: {
      seed: 'old-seed',
      name: 'OldPal',
      personality: 'Already here.',
      hatchedAt: 1,
    },
    companionMuted: true,
    companionMode: 'minimal',
  }
  installBuddyMocks()
  const buddyModule = await importFreshBuddyModule()
  const done = createOnDoneSpy()

  await buddyModule.call(done.onDone, createContext().context, `import ${inputPath} --replace`)

  expect(mockConfig.companion?.name).toBe('Runebit')
  expect(mockConfig.companionMuted).toBe(false)
  expect(mockConfig.companionMode).toBe('expressive')
  expect(done.calls[0]?.result).toContain('Buddy imported: Runebit')

  await rm(tempDir, { recursive: true, force: true })
})

test('invalid import file leaves config unchanged', async () => {
  const tempDir = join(tmpdir(), `buddy-import-invalid-${Date.now()}-${Math.random()}`)
  await mkdir(tempDir, { recursive: true })
  mockCwd = tempDir
  const inputPath = join(tempDir, 'runebit.json')
  await writeFile(inputPath, '{ bad json')
  mockConfig = {
    companion: {
      seed: 'old-seed',
      name: 'OldPal',
      personality: 'Already here.',
      hatchedAt: 1,
    },
  }
  installBuddyMocks()
  const buddyModule = await importFreshBuddyModule()
  const done = createOnDoneSpy()

  await buddyModule.call(done.onDone, createContext().context, `import ${inputPath} --replace`)

  expect(mockConfig.companion?.name).toBe('OldPal')
  expect(done.calls[0]?.result).toContain('Invalid buddy export')

  await rm(tempDir, { recursive: true, force: true })
})

test('mode command updates buddy mode', async () => {
  installBuddyMocks()
  const buddyModule = await importFreshBuddyModule()
  const done = createOnDoneSpy()

  await buddyModule.call(done.onDone, createContext().context, 'mode minimal')

  expect(mockConfig.companionMode).toBe('minimal')
  expect(done.calls[0]?.result).toContain('Minimal')
})

test('rename requires an existing buddy', async () => {
  installBuddyMocks()
  const buddyModule = await importFreshBuddyModule()
  const done = createOnDoneSpy()

  await buddyModule.call(done.onDone, createContext().context, 'rename Moss')

  expect(done.calls[0]?.result).toBe('No buddy hatched yet. Run /buddy to hatch one.')
})

test('reset replaces the buddy seed and preserves mute state', async () => {
  mockConfig = {
    userID: 'user-1',
    companion: {
      seed: 'legacy-seed',
      name: 'OldPal',
      personality: 'Calm under pressure and fond of clean diffs.',
      hatchedAt: 1,
    },
    companionMuted: true,
  }
  installBuddyMocks()
  const buddyModule = await importFreshBuddyModule()
  const done = createOnDoneSpy()

  await buddyModule.call(done.onDone, createContext().context, 'reset')

  expect(mockConfig.companion?.seed).toMatch(/^user-1:uuid-\d+$/)
  expect(mockConfig.companionMuted).toBe(true)
  expect(mockConfig.companion?.progress).toEqual({
    xpTotal: 0,
    promptTurns: 0,
    productiveTurns: 0,
    workDurationMs: 0,
    errorFeeds: 0,
    currentStreak: 0,
    bestStreak: 0,
    currentCombo: 0,
    bestCombo: 0,
    highestStatMilestone: 0,
    statBonuses: undefined,
    lastPromptAt: undefined,
    lastWorkAt: undefined,
    lastComboAt: undefined,
    lastStreakDay: undefined,
    recentPromptTurnAts: [],
    recentWorkAts: [],
    recentErrorFeedKeys: [],
    version: 4,
  })
  expect(done.calls[0]?.result).toContain('is now your buddy')
})

test('edit personality updates the stored buddy personality', async () => {
  mockConfig = {
    companion: {
      seed: 'seed-1',
      name: 'Patch',
      personality: 'Calm under pressure and fond of clean diffs.',
      hatchedAt: 1,
    },
  }
  installBuddyMocks()
  const buddyModule = await importFreshBuddyModule()
  const done = createOnDoneSpy()

  await buddyModule.call(
    done.onDone,
    createContext().context,
    'edit personality brave and curious',
  )

  expect(mockConfig.companion?.personality).toBe('brave and curious.')
  expect(done.calls[0]?.result).toBe("Updated Patch's personality.")
})

test('awardBuddyPromptTurn scales XP with token usage', async () => {
  mockConfig = {
    companion: {
      seed: 'seed-1',
      name: 'Patch',
      personality: 'Calm under pressure and fond of clean diffs.',
      hatchedAt: 1,
      progress: {
        xpTotal: 0,
        promptTurns: 0,
        productiveTurns: 0,
        workDurationMs: 0,
        errorFeeds: 0,
        currentStreak: 0,
        bestStreak: 0,
        currentCombo: 0,
        bestCombo: 0,
        highestStatMilestone: 0,
        statBonuses: undefined,
        lastPromptAt: undefined,
        lastWorkAt: undefined,
        lastComboAt: undefined,
        lastStreakDay: undefined,
        recentPromptTurnAts: [],
        recentWorkAts: [],
        recentErrorFeedKeys: [],
        version: 4,
      },
    },
  }
  installBuddyMocks()
  const buddyModule = await importFreshBuddyModule()

  const promptContext = createContext()
  buddyModule.awardBuddyPromptTurn(
    promptContext.context,
    {
      input_tokens: 2000,
      output_tokens: 4000,
      productiveTurn: {
        toolSuccesses: 1,
        toolDurationMs: 60_000,
      },
    },
    123,
  )

  expect(mockConfig.companion?.progress?.xpTotal).toBe(13)
  expect(mockConfig.companion?.progress?.promptTurns).toBe(1)
  expect(mockConfig.companion?.progress?.productiveTurns).toBe(1)
  expect(mockConfig.companion?.progress?.currentCombo).toBe(1)
  expect(mockConfig.companion?.progress?.lastPromptAt).toBe(123)
  expect(mockConfig.companion?.progress?.recentPromptTurnAts).toEqual([123])
  expect(promptContext.getAppState().companionAnimation).toEqual({
    kind: 'achievement',
    at: expect.any(Number),
  })
})

test('awardBuddyPromptTurn uses levelUp animation when the turn levels up the buddy', async () => {
  mockConfig = {
    companion: {
      seed: 'seed-1',
      name: 'Patch',
      personality: 'Calm under pressure and fond of clean diffs.',
      hatchedAt: 1,
      progress: {
        xpTotal: 19,
        promptTurns: 0,
        productiveTurns: 0,
        workDurationMs: 0,
        errorFeeds: 0,
        currentStreak: 0,
        bestStreak: 0,
        currentCombo: 0,
        bestCombo: 0,
        highestStatMilestone: 0,
        statBonuses: undefined,
        lastPromptAt: undefined,
        lastWorkAt: undefined,
        lastComboAt: undefined,
        lastStreakDay: undefined,
        recentPromptTurnAts: [],
        recentWorkAts: [],
        recentErrorFeedKeys: [],
        version: 4,
      },
    },
  }
  installBuddyMocks()
  const buddyModule = await importFreshBuddyModule()
  const levelContext = createContext()

  buddyModule.awardBuddyPromptTurn(
    levelContext.context,
    {
      input_tokens: 0,
      output_tokens: 0,
    },
    123,
  )

  expect(mockConfig.companion?.progress?.xpTotal).toBe(29)
  expect(levelContext.getAppState().companionAnimation).toEqual({
    kind: 'levelUp',
    at: expect.any(Number),
  })
})

test('awardBuddyPromptTurn celebrates combo improvements', async () => {
  mockConfig = {
    companion: {
      seed: 'seed-1',
      name: 'Patch',
      personality: 'Calm under pressure and fond of clean diffs.',
      hatchedAt: 1,
      progress: {
        xpTotal: 5,
        promptTurns: 1,
        productiveTurns: 1,
        workDurationMs: 60_000,
        errorFeeds: 0,
        currentStreak: 1,
        bestStreak: 1,
        currentCombo: 1,
        bestCombo: 1,
        highestStatMilestone: 0,
        statBonuses: undefined,
        lastPromptAt: 100,
        lastWorkAt: 100,
        lastComboAt: 100,
        lastStreakDay: 0,
        recentPromptTurnAts: [100],
        recentWorkAts: [100],
        recentErrorFeedKeys: [],
        version: 4,
      },
    },
  }
  installBuddyMocks()
  const buddyModule = await importFreshBuddyModule()
  const comboContext = createContext()

  buddyModule.awardBuddyPromptTurn(
    comboContext.context,
    {
      input_tokens: 0,
      output_tokens: 0,
      productiveTurn: {
        toolSuccesses: 1,
        toolDurationMs: 30_000,
      },
    },
    100 + 5 * 60 * 1000,
  )

  expect(mockConfig.companion?.progress?.currentCombo).toBe(2)
  expect(comboContext.getAppState().companionAnimation).toEqual({
    kind: 'achievement',
    at: expect.any(Number),
  })
})
