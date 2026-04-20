import { afterEach, expect, mock, test } from 'bun:test'
import React from 'react'

let renderToStringFn: typeof import('../../utils/staticRender.tsx').renderToString

function installBundleMock() {
  const bundleMock = {
    feature: () => false,
  }
  mock.module('bun:bundle', () => bundleMock)
  mock.module('bundle', () => bundleMock)
}

async function loadStaticRenderer() {
  installBundleMock()
  const { renderToString } = await import('../../utils/staticRender.tsx')
  renderToStringFn = renderToString
}

async function importFreshBuddyProgressByline() {
  installBundleMock()
  return import(`./BuddyProgressByline.tsx?ts=${Date.now()}-${Math.random()}`)
}

async function renderNode(node: React.ReactNode, columns = 100): Promise<string> {
  if (!renderToStringFn) {
    await loadStaticRenderer()
  }
  return renderToStringFn(node, columns)
}

type MockBuddyConfig = {
  companionMuted?: boolean
}

const mockConfig: MockBuddyConfig = {
  companionMuted: false,
}

let mockLastBuddyXpGain: number | undefined

function mockUseAppState<T>(selector: (state: { lastBuddyXpGain?: number; companionAnimation?: { at: number } }) => T): T {
  return selector({
    lastBuddyXpGain: mockLastBuddyXpGain,
    companionAnimation: { at: 0 },
  })
}

function resetBuddyProgressMocks() {
  mockLastBuddyXpGain = undefined
}

function renderBuddyText() {
  return 'Buddy L1 · ███░░░ 10/20 XP'
}

function createNodeCryptoMock() {
  return {
    randomUUID: () => 'uuid-1',
    createHash: () => ({
      update: () => ({
        digest: () => 'hash',
      }),
    }),
  }
}

function createConfigMock() {
  return {
    getGlobalConfig: () => mockConfig,
    saveGlobalConfig: () => {},
    checkHasTrustDialogAccepted: () => true,
    getOrCreateUserID: () => 'user-1',
  }
}

const mockCompanion = {
  name: 'Patch',
  species: 'owl',
  rarity: 'rare' as const,
  eye: '·' as const,
  hat: 'none' as const,
  shiny: false,
  personality: 'Calm under pressure and fond of clean diffs.',
  stats: {
    DEBUGGING: 50,
    PATIENCE: 40,
    CHAOS: 30,
    WISDOM: 20,
    SNARK: 10,
  },
  hatchedAt: 1,
  progress: {
    xpTotal: 10,
    promptTurns: 2,
    errorFeeds: 0,
    currentStreak: 1,
    bestStreak: 1,
    highestStatMilestone: 0,
    recentPromptTurnAts: [],
    recentErrorFeedKeys: [],
    version: 3,
  },
  level: 1,
  mood: 'content' as const,
}

function installBuddyProgressMocks() {
  const configMock = createConfigMock()

  mock.module('../../buddy/feature.js', () => ({
    isBuddyEnabled: () => true,
  }))
  mock.module('../../buddy/companion.js', () => ({
    getCompanion: () => mockCompanion,
  }))
  mock.module('../../state/AppState.js', () => ({
    useAppState: mockUseAppState,
  }))
  mock.module('../../utils/config.js', () => configMock)
  mock.module('../../utils/config.ts', () => configMock)
  mock.module('node:crypto', createNodeCryptoMock)
}

afterEach(() => {
  mock.restore()
  mockConfig.companionMuted = false
  resetBuddyProgressMocks()
})

test('renders compact buddy XP progress text', async () => {
  installBuddyProgressMocks()
  const { BuddyProgressByline, getBuddyProgressBylineText } =
    await importFreshBuddyProgressByline()

  expect(getBuddyProgressBylineText()).toBe(renderBuddyText())

  const output = await renderNode(<BuddyProgressByline />, 100)
  expect(output).toContain(renderBuddyText())
})

test('ignores recent XP gain in the footer text helper', async () => {
  installBuddyProgressMocks()
  const { getBuddyProgressBylineText } = await importFreshBuddyProgressByline()

  expect(getBuddyProgressBylineText(6)).toBe(renderBuddyText())
})

test('returns nothing when buddy is muted', async () => {
  mockConfig.companionMuted = true
  installBuddyProgressMocks()
  const { BuddyProgressByline, getBuddyProgressBylineText } =
    await importFreshBuddyProgressByline()

  expect(getBuddyProgressBylineText()).toBeNull()

  const output = await renderNode(<BuddyProgressByline />, 100)
  expect(output.trim()).toBe('')
})
