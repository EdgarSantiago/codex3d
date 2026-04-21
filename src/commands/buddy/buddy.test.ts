import { afterEach, expect, mock, test } from 'bun:test'
import * as actualCrypto from 'crypto'

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

function installBuddyMocks() {
  const configMock = {
    getGlobalConfig: () => mockConfig,
    saveGlobalConfig: (updater: (current: MockConfig) => MockConfig) => {
      mockConfig = updater(mockConfig)
    },
  }
  mock.module('../../utils/config.js', () => configMock)
  mock.module('../../utils/config.ts', () => configMock)

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
      setAppState: updater => {
        appState = updater(appState as never) as Record<string, unknown>
        return appState as never
      },
    } as LocalJSXCommandContext,
    getAppState: () => appState,
  }
}

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
  mockConfig = {}
  uuidCounter = 0
})

test('hatch and status use the same reconstructed buddy', async () => {
  installBuddyMocks()
  const buddyModule = await importFreshBuddyModule()
  const first = createOnDoneSpy()

  const firstContext = createContext()
  await buddyModule.call(first.onDone, firstContext.context)

  expect(mockConfig.companion?.seed).toBe('user-1:uuid-1')
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

  expect(second.calls[0]?.result).toContain(mockConfig.companion?.name ?? '')
  expect(second.calls[0]?.result).toContain(mockConfig.companion?.personality ?? '')
  expect(second.calls[0]?.result).toContain('Level 1')
  expect(second.calls[0]?.result).toContain('0 XP')
  expect(second.calls[0]?.result).toContain('Mode Balanced')
  expect(second.calls[0]?.result).toContain('Prompt turns 0')
  expect(second.calls[0]?.result).toContain('Productive turns 0 · Work 0m')
  expect(second.calls[0]?.result).toContain('Achievements 0')
  expect(second.calls[0]?.result).toContain('0/20 XP · 20 to next')
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

  expect(mockConfig.companion?.seed).toBe('user-1:uuid-1')
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
