import type {
  BuddyProgress,
  BuddyProgressEvent,
  CompanionMood,
  StoredCompanion,
} from './types.js'

const DAY_MS = 24 * 60 * 60 * 1000
const RECENT_HISTORY_LIMIT = 20
const RECENT_ERROR_FEED_LIMIT = 20
const PROMPT_TURN_XP = 10
const ERROR_FEED_XP = 5

export function createDefaultBuddyProgress(now = Date.now()): BuddyProgress {
  return {
    xpTotal: 0,
    promptTurns: 0,
    errorFeeds: 0,
    lastPromptAt: now,
    recentPromptTurnAts: [now],
    recentErrorFeedKeys: [],
    version: 2,
  }
}

export function getBuddyProgress(
  stored: Pick<StoredCompanion, 'progress'>,
): BuddyProgress {
  const progress = stored.progress
  if (!progress) {
    return {
      xpTotal: 0,
      promptTurns: 0,
      errorFeeds: 0,
      recentPromptTurnAts: [],
      recentErrorFeedKeys: [],
      version: 2,
    }
  }

  return {
    xpTotal: progress.xpTotal,
    promptTurns: progress.promptTurns,
    errorFeeds: progress.errorFeeds ?? 0,
    lastPromptAt: progress.lastPromptAt,
    recentPromptTurnAts: progress.recentPromptTurnAts,
    recentErrorFeedKeys: progress.recentErrorFeedKeys ?? [],
    version: progress.version ?? 2,
  }
}

export function getBuddyLevel(xpTotal: number): number {
  let level = 1
  let threshold = 20
  let increment = 30

  while (xpTotal >= threshold) {
    level += 1
    threshold += increment
    increment += 10
  }

  return level
}

export function getBuddyMood(
  progress: BuddyProgress,
  now = Date.now(),
): CompanionMood {
  const recentTurns = progress.recentPromptTurnAts.filter(
    ts => now - ts <= DAY_MS,
  )
  const lastPromptAt = progress.lastPromptAt

  if (recentTurns.length >= 5) {
    return 'excited'
  }

  if (lastPromptAt === undefined) {
    return 'lonely'
  }

  const age = now - lastPromptAt

  if (age <= 3 * DAY_MS) {
    return recentTurns.length >= 2 ? 'excited' : 'content'
  }

  if (age <= 7 * DAY_MS) {
    return 'sleepy'
  }

  return 'lonely'
}

export function applyBuddyProgressEvent(
  progress: BuddyProgress,
  event: BuddyProgressEvent,
): BuddyProgress {
  switch (event.type) {
    case 'prompt_turn': {
      const recentPromptTurnAts = [...progress.recentPromptTurnAts, event.at]
        .filter(ts => event.at - ts <= 7 * DAY_MS)
        .slice(-RECENT_HISTORY_LIMIT)

      return {
        ...progress,
        xpTotal: progress.xpTotal + PROMPT_TURN_XP,
        promptTurns: progress.promptTurns + 1,
        lastPromptAt: event.at,
        recentPromptTurnAts,
        version: 2,
      }
    }
    case 'tool_error': {
      if (progress.recentErrorFeedKeys.includes(event.feedKey)) {
        return {
          ...progress,
          version: 2,
        }
      }

      return {
        ...progress,
        xpTotal: progress.xpTotal + ERROR_FEED_XP,
        errorFeeds: progress.errorFeeds + 1,
        recentErrorFeedKeys: [...progress.recentErrorFeedKeys, event.feedKey].slice(
          -RECENT_ERROR_FEED_LIMIT,
        ),
        version: 2,
      }
    }
    default: {
      const _exhaustive: never = event
      return progress
    }
  }
}
