import { expect, test } from 'bun:test'

import {
  applyBuddyProgressEvent,
  createDefaultBuddyProgress,
  getBuddyAchievementCount,
  getBuddyAchievements,
  getBuddyComboBonusXp,
  getBuddyLevel,
  getBuddyLevelProgress,
  getBuddyLevelProgressBar,
  getBuddyMood,
  getBuddyMoodBar,
  getBuddyProgress,
  getBuddyPromptTurnXp,
} from './progression.js'

test('getBuddyProgress returns zeroed defaults for legacy buddies', () => {
  expect(getBuddyProgress({})).toEqual({
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
})

test('applyBuddyProgressEvent increments XP and prompt turns', () => {
  const start = getBuddyProgress({})
  const next = applyBuddyProgressEvent(start, {
    type: 'prompt_turn',
    at: 100,
    xp: 12,
  })

  expect(next.xpTotal).toBe(12)
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

test('getBuddyProgress backfills productivity fields for legacy progress', () => {
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
    recentPromptTurnAts: [100],
    recentWorkAts: [],
    recentErrorFeedKeys: [],
    version: 4,
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

test('getBuddyLevelProgressBar renders a compact XP bar', () => {
  expect(getBuddyLevelProgressBar(10, 6)).toBe('███░░░')
  expect(getBuddyLevelProgressBar(49, 6)).toBe('██████')
})

test('getBuddyPromptTurnXp scales with token usage and caps bonus XP', () => {
  expect(getBuddyPromptTurnXp(0)).toBe(10)
  expect(getBuddyPromptTurnXp(1999)).toBe(10)
  expect(getBuddyPromptTurnXp(2000)).toBe(11)
  expect(getBuddyPromptTurnXp(10000)).toBe(15)
  expect(getBuddyPromptTurnXp(50000)).toBe(15)
})

test('getBuddyMoodBar reflects simple emotional progression', () => {
  expect(
    getBuddyMoodBar({
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
      recentPromptTurnAts: [],
      recentWorkAts: [],
      recentErrorFeedKeys: [],
      version: 4,
    }),
  ).toBe('░░░░ 0/4')

  expect(
    getBuddyMoodBar({
      xpTotal: 20,
      promptTurns: 2,
      productiveTurns: 0,
      workDurationMs: 0,
      errorFeeds: 0,
      currentStreak: 0,
      bestStreak: 0,
      currentCombo: 0,
      bestCombo: 0,
      highestStatMilestone: 0,
      lastPromptAt: Date.now() - 1000,
      recentPromptTurnAts: [Date.now() - 2000, Date.now() - 1000],
      recentWorkAts: [],
      recentErrorFeedKeys: [],
      version: 4,
    }),
  ).toBe('████ 4/4')
})

test('getBuddyMood derives states from prompt fallback and productive work', () => {
  const now = 10 * 24 * 60 * 60 * 1000

  expect(
    getBuddyMood(
      {
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
        recentPromptTurnAts: [],
        recentWorkAts: [],
        recentErrorFeedKeys: [],
        version: 4,
      },
      now,
    ),
  ).toBe('lonely')

  expect(
    getBuddyMood(
      {
        xpTotal: 10,
        promptTurns: 1,
        productiveTurns: 0,
        workDurationMs: 0,
        errorFeeds: 0,
        currentStreak: 0,
        bestStreak: 0,
        currentCombo: 0,
        bestCombo: 0,
        highestStatMilestone: 0,
        lastPromptAt: now - 24 * 60 * 60 * 1000,
        recentPromptTurnAts: [now - 24 * 60 * 60 * 1000],
        recentWorkAts: [],
        recentErrorFeedKeys: [],
        version: 4,
      },
      now,
    ),
  ).toBe('content')

  expect(
    getBuddyMood(
      {
        xpTotal: 40,
        promptTurns: 4,
        productiveTurns: 0,
        workDurationMs: 0,
        errorFeeds: 0,
        currentStreak: 0,
        bestStreak: 0,
        currentCombo: 0,
        bestCombo: 0,
        highestStatMilestone: 0,
        lastPromptAt: now - 6 * 24 * 60 * 60 * 1000,
        recentPromptTurnAts: [now - 6 * 24 * 60 * 60 * 1000],
        recentWorkAts: [],
        recentErrorFeedKeys: [],
        version: 4,
      },
      now,
    ),
  ).toBe('sleepy')

  expect(
    getBuddyMood(
      {
        xpTotal: 60,
        promptTurns: 6,
        productiveTurns: 3,
        workDurationMs: 10 * 60 * 1000,
        errorFeeds: 0,
        currentStreak: 2,
        bestStreak: 2,
        currentCombo: 2,
        bestCombo: 2,
        highestStatMilestone: 0,
        lastPromptAt: now - 1000,
        lastWorkAt: now - 1000,
        lastComboAt: now - 1000,
        lastStreakDay: 1,
        recentPromptTurnAts: [now - 1000],
        recentWorkAts: [now - 1000, now - 2000],
        recentErrorFeedKeys: [],
        version: 4,
      },
      now,
    ),
  ).toBe('excited')
})

test('createDefaultBuddyProgress starts with no fake activity', () => {
  expect(createDefaultBuddyProgress(123)).toEqual({
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
})

test('productive turns update combo, streak, work time, and achievements', () => {
  const start = getBuddyProgress({})
  const first = applyBuddyProgressEvent(start, {
    type: 'productive_turn',
    at: 24 * 60 * 60 * 1000,
    toolSuccesses: 2,
    toolDurationMs: 120000,
  })
  const second = applyBuddyProgressEvent(first, {
    type: 'productive_turn',
    at: 24 * 60 * 60 * 1000 + 5 * 60 * 1000,
    toolSuccesses: 1,
    toolDurationMs: 180000,
  })
  const third = applyBuddyProgressEvent(second, {
    type: 'productive_turn',
    at: 2 * 24 * 60 * 60 * 1000,
    toolSuccesses: 1,
    toolDurationMs: 30 * 60 * 1000,
  })

  expect(first.productiveTurns).toBe(1)
  expect(first.currentCombo).toBe(1)
  expect(first.currentStreak).toBe(1)

  expect(second.currentCombo).toBe(2)
  expect(second.bestCombo).toBe(2)
  expect(second.currentStreak).toBe(1)

  expect(third.currentCombo).toBe(1)
  expect(third.currentStreak).toBe(2)
  expect(third.bestStreak).toBe(2)
  expect(third.workDurationMs).toBe(35 * 60 * 1000)
  expect(getBuddyComboBonusXp(second.currentCombo)).toBe(1)
  expect(getBuddyAchievementCount(third)).toBe(3)
  expect(getBuddyAchievements(third).map(a => a.id)).toEqual([
    'first-productive-turn',
    'combo-starter',
    'deep-work',
  ])
})
