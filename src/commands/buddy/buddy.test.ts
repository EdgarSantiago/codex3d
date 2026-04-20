import { afterEach, expect, mock, test } from 'bun:test'

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

  mock.module('crypto', () => ({
    randomUUID: () => `uuid-${++uuidCounter}`,
  }))
}

async function importFreshBuddyModule() {
  return import(`./buddy.tsx?ts=${Date.now()}-${Math.random()}`)
}

function createContext(): LocalJSXCommandContext {
  return {
    setAppState: updater => updater({} as never),
  } as LocalJSXCommandContext
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

  await buddyModule.call(first.onDone, createContext())

  expect(mockConfig.companion?.seed).toBe('user-1:uuid-1')
  expect(mockConfig.companionMuted).toBe(false)
  expect(mockConfig.companion?.progress).toEqual({
    xpTotal: 0,
    promptTurns: 0,
    errorFeeds: 0,
    currentStreak: 1,
    bestStreak: 1,
    highestStatMilestone: 0,
    statBonuses: undefined,
    lastPromptAt: expect.any(Number),
    recentPromptTurnAts: [expect.any(Number)],
    recentErrorFeedKeys: [],
    version: 3,
  })
  expect(first.calls[0]?.result).toContain('is now your buddy')

  const second = createOnDoneSpy()
  await buddyModule.call(second.onDone, createContext(), 'status')

  expect(second.calls[0]?.result).toContain(mockConfig.companion?.name ?? '')
  expect(second.calls[0]?.result).toContain(mockConfig.companion?.personality ?? '')
  expect(second.calls[0]?.result).toContain('Level 1')
  expect(second.calls[0]?.result).toContain('0 XP')
  expect(second.calls[0]?.result).toContain('Mode Balanced')
  expect(second.calls[0]?.result).toContain('Prompt turns 0')
  expect(second.calls[0]?.result).toContain('0/20 XP · 20 to next')
})

test('mode command updates buddy mode', async () => {
  installBuddyMocks()
  const buddyModule = await importFreshBuddyModule()
  const done = createOnDoneSpy()

  await buddyModule.call(done.onDone, createContext(), 'mode minimal')

  expect(mockConfig.companionMode).toBe('minimal')
  expect(done.calls[0]?.result).toContain('Minimal')
})

test('rename requires an existing buddy', async () => {
  installBuddyMocks()
  const buddyModule = await importFreshBuddyModule()
  const done = createOnDoneSpy()

  await buddyModule.call(done.onDone, createContext(), 'rename Moss')

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

  await buddyModule.call(done.onDone, createContext(), 'reset')

  expect(mockConfig.companion?.seed).toBe('user-1:uuid-1')
  expect(mockConfig.companionMuted).toBe(true)
  expect(mockConfig.companion?.progress).toEqual({
    xpTotal: 0,
    promptTurns: 0,
    errorFeeds: 0,
    currentStreak: 1,
    bestStreak: 1,
    highestStatMilestone: 0,
    statBonuses: undefined,
    lastPromptAt: expect.any(Number),
    recentPromptTurnAts: [expect.any(Number)],
    recentErrorFeedKeys: [],
    version: 3,
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
    createContext(),
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
        errorFeeds: 0,
        currentStreak: 0,
        bestStreak: 0,
        highestStatMilestone: 0,
        statBonuses: undefined,
        recentPromptTurnAts: [],
        recentErrorFeedKeys: [],
        version: 3,
      },
    },
  }
  installBuddyMocks()
  const buddyModule = await importFreshBuddyModule()

  buddyModule.awardBuddyPromptTurn(
    createContext(),
    {
      input_tokens: 2000,
      output_tokens: 4000,
    },
    123,
  )

  expect(mockConfig.companion?.progress?.xpTotal).toBe(13)
  expect(mockConfig.companion?.progress?.promptTurns).toBe(1)
  expect(mockConfig.companion?.progress?.lastPromptAt).toBe(123)
  expect(mockConfig.companion?.progress?.recentPromptTurnAts).toEqual([123])
})
