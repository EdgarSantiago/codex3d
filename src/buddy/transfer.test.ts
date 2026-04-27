import { expect, test } from 'bun:test'

import type { BuddyProgress } from './types.js'
import {
  createBuddyExport,
  parseBuddyExport,
  serializeBuddyExport,
  summarizeBuddyExport,
} from './transfer.js'

const progress: BuddyProgress = {
  xpTotal: 42,
  promptTurns: 4,
  productiveTurns: 2,
  workDurationMs: 120000,
  errorFeeds: 1,
  currentStreak: 1,
  bestStreak: 1,
  currentCombo: 2,
  bestCombo: 2,
  highestStatMilestone: 0,
  statBonuses: undefined,
  lastPromptAt: 100,
  lastWorkAt: 100,
  lastComboAt: 100,
  lastStreakDay: 1,
  recentPromptTurnAts: [1, 2, 3, 4],
  recentWorkAts: [3, 4],
  recentErrorFeedKeys: ['tool:error'],
  version: 4,
}

test('createBuddyExport whitelists buddy fields only', () => {
  const result = createBuddyExport({
    companion: {
      seed: 'seed-1',
      name: 'Runebit',
      personality: 'Patient watcher.',
      hatchedAt: 123,
      progress,
    },
    companionMuted: true,
    companionMode: 'expressive',
    userID: 'secret-user',
    oauthAccount: { emailAddress: 'user@example.com' },
  } as never, 456)

  expect(result.ok).toBe(true)
  if (!result.ok) return
  expect(result.value).toEqual({
    format: 'codex3d.buddy.export',
    version: 1,
    exportedAt: 456,
    companion: {
      seed: 'seed-1',
      name: 'Runebit',
      personality: 'Patient watcher.',
      hatchedAt: 123,
      progress,
    },
    companionMuted: true,
    companionMode: 'expressive',
  })
  expect(JSON.stringify(result.value)).not.toContain('secret-user')
  expect(JSON.stringify(result.value)).not.toContain('user@example.com')
})

test('createBuddyExport fails when no buddy exists', () => {
  const result = createBuddyExport({}, 456)

  expect(result).toEqual({
    ok: false,
    error: 'No buddy hatched yet. Run /buddy to hatch one.',
  })
})

test('parseBuddyExport validates format and mode', () => {
  expect(parseBuddyExport('{"format":"wrong","version":1,"exportedAt":1,"companion":{}}')).toEqual({
    ok: false,
    error: 'Unsupported buddy export format.',
  })

  const result = parseBuddyExport(JSON.stringify({
    format: 'codex3d.buddy.export',
    version: 1,
    exportedAt: 1,
    companion: {
      seed: 'seed-1',
      name: 'Runebit',
      personality: 'Patient watcher.',
      hatchedAt: 123,
      progress,
    },
    companionMode: 'loud',
  }))

  expect(result).toEqual({
    ok: false,
    error: 'companionMode must be minimal, balanced, or expressive.',
  })
})

test('parseBuddyExport rejects malformed progress arrays before normalization', () => {
  const result = parseBuddyExport(JSON.stringify({
    format: 'codex3d.buddy.export',
    version: 1,
    exportedAt: 1,
    companion: {
      seed: 'seed-1',
      name: 'Runebit',
      personality: 'Patient watcher.',
      hatchedAt: 123,
      progress: {
        ...progress,
        recentPromptTurnAts: 'bad',
      },
    },
  }))

  expect(result).toEqual({
    ok: false,
    error: 'recentPromptTurnAts must be an array.',
  })
})

test('parseBuddyExport preserves legacy missing seed with a warning', () => {
  const result = parseBuddyExport(JSON.stringify({
    format: 'codex3d.buddy.export',
    version: 1,
    exportedAt: 1,
    companion: {
      name: 'Legacy',
      personality: 'Old friend.',
      hatchedAt: 123,
    },
  }))

  expect(result.ok).toBe(true)
  if (!result.ok) return
  expect(result.value.companion.seed).toBeUndefined()
  expect(result.value.companion.progress?.version).toBe(4)
  expect(result.warnings).toContain('This buddy has no seed, so appearance may not transfer exactly.')
})

test('serializeBuddyExport round-trips and summarizeBuddyExport reports level', () => {
  const exportData = createBuddyExport({
    companion: {
      seed: 'seed-1',
      name: 'Runebit',
      personality: 'Patient watcher.',
      hatchedAt: 123,
      progress,
    },
  }, 456)
  expect(exportData.ok).toBe(true)
  if (!exportData.ok) return

  const parsed = parseBuddyExport(serializeBuddyExport(exportData.value))
  expect(parsed.ok).toBe(true)
  if (!parsed.ok) return
  expect(summarizeBuddyExport(parsed.value)).toBe('Runebit · Level 2 · 42 XP')
})
