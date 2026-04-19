import type { Message } from '../types/message.js'
import { getGlobalConfig } from '../utils/config.js'
import { getUserMessageText } from '../utils/messages.js'
import { getCompanion } from './companion.js'
import { isBuddyCommentaryEnabled } from './types.js'

const DIRECT_REPLIES = {
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
} as const

const PET_REPLIES = {
  excited: ['does a neon backflip', 'spins up a victory chirp', 'vibrates with terminal joy'],
  content: ['happy chirp', 'quietly approves', 'looks pleased'],
  sleepy: ['boots into a gentle wiggle', 'emits a cozy startup beep', 'blinks awake and leans in'],
  lonely: ['wiggles like you just logged back in', 'does a relieved little bounce', 'looks delighted to see activity'],
} as const

const ERROR_REPLIES = {
  excited: ['Error consumed. More chaos, please.', 'Crunchy stack trace. Delicious.', 'That exception barely touched the sides.'],
  content: ['Error packet safely digested.', 'I have disposed of the faulty bytes.', 'Bad output converted into buddy fuel.'],
  sleepy: ['I ate the error. I may nap after this.', 'Slow chew, but the exception is handled.', 'The failing bytes have been gently consumed.'],
  lonely: ['Finally, a haunted little error for me.', 'I missed you so much I even ate the exception.', 'The lonely terminal offers me a tragic snack.'],
} as const

function getMoodReply<T>(
  table: Record<'excited' | 'content' | 'sleepy' | 'lonely', readonly T[]>,
  mood: keyof typeof table,
  seed: string,
): T {
  return pickDeterministic(table[mood], seed)
}

function isErrorFeedKey(key: string): boolean {
  return key.includes(':')
}

function getLatestErrorFeedKey(companion: ReturnType<typeof getCompanion>): string | undefined {
  const keys = companion?.progress.recentErrorFeedKeys
  if (!keys || keys.length === 0) return undefined
  const latest = keys[keys.length - 1]
  return latest && isErrorFeedKey(latest) ? latest : undefined
}

function createErrorFeedReaction(companion: NonNullable<ReturnType<typeof getCompanion>>): string | undefined {
  const latestErrorFeedKey = getLatestErrorFeedKey(companion)
  if (!latestErrorFeedKey) return undefined
  return `${companion.name}: ${getMoodReply(ERROR_REPLIES, companion.mood, latestErrorFeedKey + companion.name)}`
}

function createDirectReaction(companion: NonNullable<ReturnType<typeof getCompanion>>, text: string): string {
  return `${companion.name}: ${getMoodReply(DIRECT_REPLIES, companion.mood, text + companion.personality)}`
}

function createPetReaction(companion: NonNullable<ReturnType<typeof getCompanion>>, text: string): string {
  return getMoodReply(PET_REPLIES, companion.mood, text + companion.name)
}

function shouldUseErrorCommentary(text: string): boolean {
  const lower = text.toLowerCase()
  return lower.includes('error') || lower.includes('failed') || lower.includes('exception')
}

function hashString(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function pickDeterministic<T>(items: readonly T[], seed: string): T {
  return items[hashString(seed) % items.length]!
}

export async function fireCompanionObserver(
  messages: Message[],
  onReaction: (reaction: string | undefined) => void,
): Promise<void> {
  const config = getGlobalConfig()
  const companion = getCompanion()
  if (!companion || config.companionMuted || !isBuddyCommentaryEnabled(config)) return

  const lastUser = [...messages].reverse().find(msg => msg.type === 'user')
  if (!lastUser) return

  const text = getUserMessageText(lastUser)?.trim()
  if (!text) return

  const lower = text.toLowerCase()
  const companionName = companion.name.toLowerCase()

  if (lower.includes('/buddy')) {
    onReaction(createPetReaction(companion, text))
    return
  }

  if (shouldUseErrorCommentary(text)) {
    const errorReaction = createErrorFeedReaction(companion)
    if (errorReaction) {
      onReaction(errorReaction)
      return
    }
  }

  if (
    lower.includes(companionName) ||
    lower.includes('buddy') ||
    lower.includes('companion')
  ) {
    onReaction(createDirectReaction(companion, text))
  }
}
