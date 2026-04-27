import { afterEach, expect, mock, test } from 'bun:test'

import type { BuddyProgress, StoredCompanion } from './types.js'

type MockGlobalConfig = {
  companion?: StoredCompanion
  oauthAccount?: { accountUuid: string }
  userID?: string
}

let mockGlobalConfig: MockGlobalConfig = {}

async function importFreshCompanionModule() {
  return import(`./companion.ts?ts=${Date.now()}-${Math.random()}`)
}

function installCompanionMocks() {
  const configMock = {
    getGlobalConfig: () => mockGlobalConfig,
    saveGlobalConfig: () => {},
  }
  mock.module('../utils/config.js', () => configMock)
  mock.module('../utils/config.ts', () => configMock)
}

afterEach(() => {
  mock.restore()
  mockGlobalConfig = {}
})

test('getCompanionFromStored uses stored seed when present', async () => {
  installCompanionMocks()
  const companionModule = await importFreshCompanionModule()

  const stored: StoredCompanion = {
    seed: 'seed-123',
    name: 'Whiskmoss',
    personality: 'Curious and quietly encouraging.',
    hatchedAt: 123,
    progress: {
      xpTotal: 20,
      promptTurns: 2,
      productiveTurns: 99,
      workDurationMs: 99,
      errorFeeds: 1,
      currentStreak: 3,
      bestStreak: 4,
      currentCombo: 2,
      bestCombo: 3,
      highestStatMilestone: 1,
      lastPromptAt: 123,
      lastWorkAt: 456,
      lastComboAt: 456,
      lastStreakDay: 1,
      recentPromptTurnAts: [123, 122],
      recentWorkAts: [456],
      recentErrorFeedKeys: ['tool:error'],
      version: 1,
    } satisfies BuddyProgress,
  }

  const companion = companionModule.getCompanionFromStored(stored)
  const seededRoll = companionModule.rollWithSeed('seed-123').bones

  expect(companion).toMatchObject({
    ...stored,
    ...seededRoll,
    progress: {
      xpTotal: 20,
      promptTurns: 2,
      lastPromptAt: 123,
      recentPromptTurnAts: [123, 122],
      version: 4,
    },
    level: 2,
    mood: 'lonely',
  })
})

test('getCompanionFromStored falls back to legacy user roll without a seed', async () => {
  mockGlobalConfig = { userID: 'legacy-user' }
  installCompanionMocks()
  const companionModule = await importFreshCompanionModule()

  const stored: StoredCompanion = {
    name: 'OldPal',
    personality: 'Calm under pressure and fond of clean diffs.',
    hatchedAt: 456,
  }

  const companion = companionModule.getCompanionFromStored(stored)
  const legacyRoll = companionModule.roll('legacy-user').bones

  expect(companion).toMatchObject({
    ...stored,
    ...legacyRoll,
  })
})
