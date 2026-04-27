import type { Message } from '../types/message.js'
import { getGlobalConfig } from '../utils/config.js'
import { getUserMessageText } from '../utils/messages.js'
import { getCompanion } from './companion.js'
import {
  BUDDY_DIRECT_PHRASES,
  BUDDY_ERROR_PHRASES,
  BUDDY_OBSERVER_PET_PHRASES,
  pickBuddyPhrase,
  type BuddyMoodPhraseTable,
} from './phrases.js'
import { isBuddyCommentaryEnabled } from './types.js'

function getMoodReply(
  table: BuddyMoodPhraseTable,
  mood: keyof typeof table,
  seed: string,
): string {
  return pickBuddyPhrase(table[mood], seed)
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
  return `${companion.name}: ${getMoodReply(BUDDY_ERROR_PHRASES, companion.mood, latestErrorFeedKey + companion.name)}`
}

function createDirectReaction(companion: NonNullable<ReturnType<typeof getCompanion>>, text: string): string {
  return `${companion.name}: ${getMoodReply(BUDDY_DIRECT_PHRASES, companion.mood, text + companion.personality)}`
}

function createPetReaction(companion: NonNullable<ReturnType<typeof getCompanion>>, text: string): string {
  return getMoodReply(BUDDY_OBSERVER_PET_PHRASES, companion.mood, text + companion.name)
}

function shouldUseErrorCommentary(text: string): boolean {
  const lower = text.toLowerCase()
  return lower.includes('error') || lower.includes('failed') || lower.includes('exception')
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
