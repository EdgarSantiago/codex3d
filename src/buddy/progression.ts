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
const TOKENS_PER_BONUS_XP = 2000
const MAX_PROMPT_TURN_BONUS_XP = 5

export function createDefaultBuddyProgress(now = Date.now()): BuddyProgress {
  return {
    xpTotal: 0,
    promptTurns: 0,
    errorFeeds: 0,
    currentStreak: 1,
    bestStreak: 1,
    highestStatMilestone: 0,
    statBonuses: undefined,
    lastPromptAt: now,
    recentPromptTurnAts: [now],
    recentErrorFeedKeys: [],
    version: 3,
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
      currentStreak: 0,
      bestStreak: 0,
      highestStatMilestone: 0,
      statBonuses: undefined,
      recentPromptTurnAts: [],
      recentErrorFeedKeys: [],
      version: 3,
    }
  }

  return {
    xpTotal: progress.xpTotal,
    promptTurns: progress.promptTurns,
    errorFeeds: progress.errorFeeds ?? 0,
    currentStreak: progress.currentStreak ?? 0,
    bestStreak: progress.bestStreak ?? progress.currentStreak ?? 0,
    highestStatMilestone: progress.highestStatMilestone ?? 0,
    statBonuses: progress.statBonuses,
    lastPromptAt: progress.lastPromptAt,
    recentPromptTurnAts: progress.recentPromptTurnAts,
    recentErrorFeedKeys: progress.recentErrorFeedKeys ?? [],
    version: progress.version ?? 3,
  }
}

export function getBuddyLevel(xpTotal: number): number {
  return getBuddyLevelProgress(xpTotal).level
}

export function getBuddyLevelProgress(xpTotal: number): {
  level: number
  currentLevelStartXp: number
  nextLevelXp: number
  xpIntoLevel: number
  xpNeededThisLevel: number
  xpRemaining: number
} {
  let level = 1
  let currentLevelStartXp = 0
  let nextLevelXp = 20
  let increment = 30

  while (xpTotal >= nextLevelXp) {
    level += 1
    currentLevelStartXp = nextLevelXp
    nextLevelXp += increment
    increment += 10
  }

  return {
    level,
    currentLevelStartXp,
    nextLevelXp,
    xpIntoLevel: xpTotal - currentLevelStartXp,
    xpNeededThisLevel: nextLevelXp - currentLevelStartXp,
    xpRemaining: nextLevelXp - xpTotal,
  }
}

export function getBuddyLevelProgressBar(
  xpTotal: number,
  width = 16,
): string {
  const progress = getBuddyLevelProgress(xpTotal)
  const ratio = progress.xpNeededThisLevel === 0
    ? 1
    : progress.xpIntoLevel / progress.xpNeededThisLevel
  const filled = Math.max(0, Math.min(width, Math.round(ratio * width)))
  return `${'█'.repeat(filled)}${'░'.repeat(Math.max(0, width - filled))}`
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

export function getBuddyMoodIcon(mood: CompanionMood): string {
  switch (mood) {
    case 'excited':
      return '✦'
    case 'content':
      return '•'
    case 'sleepy':
      return 'zZ'
    case 'lonely':
      return '…'
    default: {
      const _exhaustive: never = mood
      return _exhaustive
    }
  }
}

export function getBuddyMoodLabel(mood: CompanionMood): string {
  return mood.charAt(0).toUpperCase() + mood.slice(1)
}

export function getBuddyMoodDisplay(mood: CompanionMood): string {
  return `${getBuddyMoodIcon(mood)} ${getBuddyMoodLabel(mood)}`
}

export function getBuddyMoodMeter(progress: BuddyProgress, now = Date.now()): {
  value: number
  max: number
  filled: number
  bar: string
} {
  const recentTurns = progress.recentPromptTurnAts.filter(
    ts => now - ts <= DAY_MS,
  )
  const lastPromptAt = progress.lastPromptAt

  let value = 0
  if (recentTurns.length >= 5) {
    value = 4
  } else if (lastPromptAt === undefined) {
    value = 0
  } else {
    const age = now - lastPromptAt
    if (age <= 3 * DAY_MS) {
      value = recentTurns.length >= 2 ? 3 : 2
    } else if (age <= 7 * DAY_MS) {
      value = 1
    }
  }

  const max = 4
  const filled = Math.max(0, Math.min(max, value))
  return {
    value,
    max,
    filled,
    bar: `${'█'.repeat(filled)}${'░'.repeat(max - filled)}`,
  }
}

export function getBuddyMoodBar(progress: BuddyProgress, now = Date.now()): string {
  const meter = getBuddyMoodMeter(progress, now)
  return `${meter.bar} ${meter.value}/${meter.max}`
}

export function getBuddyPromptTurnBonusXp(tokenUsage = 0): number {
  return Math.max(
    0,
    Math.min(MAX_PROMPT_TURN_BONUS_XP, Math.floor(tokenUsage / TOKENS_PER_BONUS_XP)),
  )
}

export function getBuddyPromptTurnXp(tokenUsage = 0): number {
  return PROMPT_TURN_XP + getBuddyPromptTurnBonusXp(tokenUsage)
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
        xpTotal: progress.xpTotal + event.xp,
        promptTurns: progress.promptTurns + 1,
        currentStreak: 1,
        bestStreak: Math.max(progress.bestStreak, 1),
        lastPromptAt: event.at,
        recentPromptTurnAts,
        version: 3,
      }
    }
    case 'prompt_turn_bonus': {
      if (event.xp <= 0) {
        return {
          ...progress,
          version: 3,
        }
      }

      return {
        ...progress,
        xpTotal: progress.xpTotal + event.xp,
        version: 3,
      }
    }
    case 'tool_error': {
      if (progress.recentErrorFeedKeys.includes(event.feedKey)) {
        return {
          ...progress,
          version: 3,
        }
      }

      return {
        ...progress,
        xpTotal: progress.xpTotal + ERROR_FEED_XP,
        errorFeeds: progress.errorFeeds + 1,
        recentErrorFeedKeys: [...progress.recentErrorFeedKeys, event.feedKey].slice(
          -RECENT_ERROR_FEED_LIMIT,
        ),
        version: 3,
      }
    }
    default: {
      const _exhaustive: never = event
      return progress
    }
  }
}
