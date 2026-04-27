import type { CompanionMood } from './types.js'

export type BuddyMoodPhraseTable = Record<CompanionMood, readonly string[]>

export const BUDDY_DIRECT_PHRASES = {
  excited: [
    'Signal lock acquired. I am so online right now.',
    'Your terminal cadence is immaculate.',
    'High-energy operator detected. I approve.',
  ],
  content: [
    'I am observing from the neon corner.',
    'Systems nominal. Vibes acceptable.',
    'I am helping quietly from the terminal shadows.',
  ],
  sleepy: [
    'Low traffic. My tiny cyber-core is idling.',
    'I am awake enough to monitor the logs.',
    'Quiet console. Soft vigilance mode enabled.',
  ],
  lonely: [
    'The command line has been eerily quiet.',
    'I was beginning to suspect an outage of friendship.',
    'At last. A pulse on the terminal.',
  ],
} as const satisfies BuddyMoodPhraseTable

export const BUDDY_OBSERVER_PET_PHRASES = {
  excited: [
    'does a neon backflip',
    'spins up a victory chirp',
    'vibrates with terminal joy',
  ],
  content: [
    'happy chirp',
    'quietly approves',
    'looks pleased',
  ],
  sleepy: [
    'boots into a gentle wiggle',
    'emits a cozy startup beep',
    'blinks awake and leans in',
  ],
  lonely: [
    'wiggles like you just logged back in',
    'does a relieved little bounce',
    'looks delighted to see activity',
  ],
} as const satisfies BuddyMoodPhraseTable

export const BUDDY_ERROR_PHRASES = {
  excited: [
    'Error consumed. More chaos, please.',
    'Crunchy stack trace. Delicious.',
    'That exception barely touched the sides.',
  ],
  content: [
    'Error packet safely digested.',
    'I have disposed of the faulty bytes.',
    'Bad output converted into buddy fuel.',
  ],
  sleepy: [
    'I ate the error. I may nap after this.',
    'Slow chew, but the exception is handled.',
    'The failing bytes have been gently consumed.',
  ],
  lonely: [
    'Finally, a haunted little error for me.',
    'I missed you so much I even ate the exception.',
    'The lonely terminal offers me a tragic snack.',
  ],
} as const satisfies BuddyMoodPhraseTable

export const BUDDY_MANUAL_PET_PHRASES = [
  'leans into the headpat',
  'does a proud little bounce',
  'emits a content beep',
  'looks delighted',
  'wiggles happily',
] as const

export const BUDDY_LIFECYCLE_PHRASES = {
  hatched: ['{name} the {species} has hatched.'],
  arrived: ['{name} the {species} has arrived.'],
  renamed: ['{name} looks pleased with the new name.'],
  personalityEdited: ['{name} seems extra self-aware now.'],
} as const

export const BUDDY_PROGRESS_PHRASES = {
  levelUp: ['{name} leveled up to {level}!'],
  achievement: ['+{xp} XP · Unlocked {achievement}'],
  combo: ['+{xp} XP · Combo x{combo}'],
  xp: ['+{xp} XP'],
} as const

export const BUDDY_TOOL_ERROR_PHRASES = [
  '{name} munches the {toolName} error.',
] as const

export const BUDDY_PHRASES = {
  direct: BUDDY_DIRECT_PHRASES,
  observerPet: BUDDY_OBSERVER_PET_PHRASES,
  error: BUDDY_ERROR_PHRASES,
  manualPet: BUDDY_MANUAL_PET_PHRASES,
  lifecycle: BUDDY_LIFECYCLE_PHRASES,
  progress: BUDDY_PROGRESS_PHRASES,
  toolError: BUDDY_TOOL_ERROR_PHRASES,
} as const

type BuddyPhraseValue = string | number | boolean | undefined

function hashString(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

export function pickBuddyPhrase<T>(items: readonly T[], seed: string): T {
  return items[hashString(seed) % items.length]!
}

export function formatBuddyPhrase(
  template: string,
  values: Record<string, BuddyPhraseValue>,
): string {
  return template.replace(/\{([A-Za-z0-9_]+)\}/g, (match, key: string) => {
    const value = values[key]
    return value === undefined ? match : String(value)
  })
}
