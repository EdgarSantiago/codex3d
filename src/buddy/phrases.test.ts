import { expect, test } from 'bun:test'

import {
  BUDDY_ERROR_PHRASES,
  BUDDY_LIFECYCLE_PHRASES,
  BUDDY_OBSERVER_PET_PHRASES,
  BUDDY_DIRECT_PHRASES,
  BUDDY_MANUAL_PET_PHRASES,
  BUDDY_PROGRESS_PHRASES,
  BUDDY_TOOL_ERROR_PHRASES,
  formatBuddyPhrase,
  pickBuddyPhrase,
  type BuddyMoodPhraseTable,
} from './phrases.js'
import type { CompanionMood } from './types.js'

const MOODS: CompanionMood[] = ['excited', 'content', 'sleepy', 'lonely']

function expectMoodTableCoverage(table: BuddyMoodPhraseTable) {
  for (const mood of MOODS) {
    expect(table[mood].length).toBeGreaterThan(0)
  }
}

test('mood-aware buddy phrase tables cover every mood', () => {
  expectMoodTableCoverage(BUDDY_DIRECT_PHRASES)
  expectMoodTableCoverage(BUDDY_OBSERVER_PET_PHRASES)
  expectMoodTableCoverage(BUDDY_ERROR_PHRASES)
})

test('flat buddy phrase arrays are not empty', () => {
  expect(BUDDY_MANUAL_PET_PHRASES.length).toBeGreaterThan(0)
  expect(BUDDY_TOOL_ERROR_PHRASES.length).toBeGreaterThan(0)

  for (const phrases of Object.values(BUDDY_LIFECYCLE_PHRASES)) {
    expect(phrases.length).toBeGreaterThan(0)
  }

  for (const phrases of Object.values(BUDDY_PROGRESS_PHRASES)) {
    expect(phrases.length).toBeGreaterThan(0)
  }
})

test('formatBuddyPhrase replaces known placeholders and preserves unknown ones', () => {
  expect(formatBuddyPhrase('{name} gained {xp} XP near {unknown}.', {
    name: 'Patch',
    xp: 12,
  })).toBe('Patch gained 12 XP near {unknown}.')
})

test('pickBuddyPhrase is deterministic for a seed', () => {
  const first = pickBuddyPhrase(BUDDY_MANUAL_PET_PHRASES, 'seed-1')
  const second = pickBuddyPhrase(BUDDY_MANUAL_PET_PHRASES, 'seed-1')

  expect(second).toBe(first)
})
