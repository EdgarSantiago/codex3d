import { expect, test } from 'bun:test'

import {
  applyBuddyProgressEvent,
  createDefaultBuddyProgress,
  getBuddyLevel,
  getBuddyLevelProgress,
  getBuddyMood,
  getBuddyMoodBar,
  getBuddyProgress,
} from './progression.js'

test('getBuddyProgress returns zeroed defaults for legacy buddies', () => {
  expect(getBuddyProgress({})).toEqual({
    xpTotal: 0,
    promptTurns: 0,
    errorFeeds: 0,
    recentPromptTurnAts: [],
    recentErrorFeedKeys: [],
    version: 2,
  })
})

test('applyBuddyProgressEvent increments XP and prompt turns', () => {
  const start = getBuddyProgress({})
  const next = applyBuddyProgressEvent(start, {
    type: 'prompt_turn',
    at: 100,
  })

  expect(next.xpTotal).toBe(10)
  expect(next.promptTurns).toBe(1)
  expect(next.errorFeeds).toBe(0)
  expect(next.lastPromptAt).toBe(100)
  expect(next.recentPromptTurnAts).toEqual([100])
})

test('tool_error awards XP once and dedupes by feed key', () => {
  const start = getBuddyProgress({})
  const first = applyBuddyProgressEvent(start, {
    type: 'tool_error',
    at: 100,
    feedKey: 'chain:Read:Error',
  })
  const second = applyBuddyProgressEvent(first, {
    type: 'tool_error',
    at: 101,
    feedKey: 'chain:Read:Error',
  })

  expect(first.xpTotal).toBe(5)
  expect(first.errorFeeds).toBe(1)
  expect(first.recentErrorFeedKeys).toEqual(['chain:Read:Error'])
  expect(second).toEqual(first)
})

test('getBuddyProgress backfills error-feed fields for legacy progress', () => {
  expect(
    getBuddyProgress({
      progress: {
        xpTotal: 10,
        promptTurns: 1,
        recentPromptTurnAts: [100],
        version: 1,
      },
    }),
  ).toEqual({
    xpTotal: 10,
    promptTurns: 1,
    errorFeeds: 0,
    lastPromptAt: undefined,
    recentPromptTurnAts: [100],
    recentErrorFeedKeys: [],
    version: 1,
  })
})

test('tool_error feed key history is capped', () => {
  let progress = getBuddyProgress({})
  for (let i = 0; i < 25; i++) {
    progress = applyBuddyProgressEvent(progress, {
      type: 'tool_error',
      at: i,
      feedKey: `feed-${i}`,
    })
  }

  expect(progress.recentErrorFeedKeys).toHaveLength(20)
  expect(progress.recentErrorFeedKeys[0]).toBe('feed-5')
  expect(progress.recentErrorFeedKeys.at(-1)).toBe('feed-24')
})

test('getBuddyLevel uses the staged XP curve', () => {
  expect(getBuddyLevel(0)).toBe(1)
  expect(getBuddyLevel(19)).toBe(1)
  expect(getBuddyLevel(20)).toBe(2)
  expect(getBuddyLevel(49)).toBe(2)
  expect(getBuddyLevel(50)).toBe(3)
  expect(getBuddyLevel(90)).toBe(4)
})

test('getBuddyLevelProgress reports the current level segment', () => {
  expect(getBuddyLevelProgress(0)).toEqual({
    level: 1,
    currentLevelStartXp: 0,
    nextLevelXp: 20,
    xpIntoLevel: 0,
    xpNeededThisLevel: 20,
    xpRemaining: 20,
  })

  expect(getBuddyLevelProgress(49)).toEqual({
    level: 2,
    currentLevelStartXp: 20,
    nextLevelXp: 50,
    xpIntoLevel: 29,
    xpNeededThisLevel: 30,
    xpRemaining: 1,
  })
})

test('getBuddyMoodBar reflects simple emotional progression', () => {
  expect(
    getBuddyMoodBar({
      xpTotal: 0,
      promptTurns: 0,
      errorFeeds: 0,
      recentPromptTurnAts: [],
      recentErrorFeedKeys: [],
      version: 1,
    }),
  ).toBe('░░░░ 0/4')

  expect(
    getBuddyMoodBar({
      xpTotal: 20,
      promptTurns: 2,
      errorFeeds: 0,
      lastPromptAt: Date.now() - 1000,
      recentPromptTurnAts: [Date.now() - 2000, Date.now() - 1000],
      recentErrorFeedKeys: [],
      version: 1,
    }),
  ).toBe('███░ 3/4')
})

test('getBuddyMood derives simple states from recent prompt activity', () => {
  const now = 10 * 24 * 60 * 60 * 1000

  expect(
    getBuddyMood(
      {
        xpTotal: 0,
        promptTurns: 0,
        errorFeeds: 0,
        recentPromptTurnAts: [],
        recentErrorFeedKeys: [],
        version: 1,
      },
      now,
    ),
  ).toBe('lonely')

  expect(
    getBuddyMood(
      {
        xpTotal: 10,
        promptTurns: 1,
        errorFeeds: 0,
        lastPromptAt: now - 24 * 60 * 60 * 1000,
        recentPromptTurnAts: [now - 24 * 60 * 60 * 1000],
        recentErrorFeedKeys: [],
        version: 1,
      },
      now,
    ),
  ).toBe('content')

  expect(
    getBuddyMood(
      {
        xpTotal: 40,
        promptTurns: 4,
        errorFeeds: 0,
        lastPromptAt: now - 6 * 24 * 60 * 60 * 1000,
        recentPromptTurnAts: [now - 6 * 24 * 60 * 60 * 1000],
        recentErrorFeedKeys: [],
        version: 1,
      },
      now,
    ),
  ).toBe('sleepy')

  expect(
    getBuddyMood(
      {
        xpTotal: 60,
        promptTurns: 6,
        errorFeeds: 0,
        lastPromptAt: now - 1000,
        recentPromptTurnAts: [
          now - 1000,
          now - 2000,
          now - 3000,
          now - 4000,
          now - 5000,
        ],
        recentErrorFeedKeys: [],
        version: 1,
      },
      now,
    ),
  ).toBe('excited')
})

test('createDefaultBuddyProgress seeds initial prompt history', () => {
  expect(createDefaultBuddyProgress(123)).toEqual({
    xpTotal: 0,
    promptTurns: 0,
    errorFeeds: 0,
    lastPromptAt: 123,
    recentPromptTurnAts: [123],
    recentErrorFeedKeys: [],
    version: 2,
  })
})
