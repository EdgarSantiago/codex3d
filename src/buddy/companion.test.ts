import { afterEach, expect, mock, test } from 'bun:test'

import type { StoredCompanion } from './types.js'

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
      lastPromptAt: 123,
      recentPromptTurnAts: [123, 122],
      version: 1,
    },
  }

  const companion = companionModule.getCompanionFromStored(stored)
  const seededRoll = companionModule.rollWithSeed('seed-123').bones

  expect(companion).toMatchObject({
    ...stored,
    ...seededRoll,
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
