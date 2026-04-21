import type {
  BuddyAchievement,
  BuddyAchievementId,
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
const BUDDY_PROGRESS_VERSION = 4
const COMBO_WINDOW_MS = 15 * 60 * 1000
const MAX_COMBO_BONUS_XP = 4

const BUDDY_ACHIEVEMENTS: BuddyAchievement[] = [
  {
    id: 'first-productive-turn',
    label: 'First Productive Turn',
    shortLabel: 'First work',
    description: 'Complete your first productive buddy turn.',
  },
  {
    id: 'combo-starter',
    label: 'Combo Starter',
    shortLabel: 'x2 combo',
    description: 'Reach a productivity combo of 2.',
  },
  {
    id: 'combo-master',
    label: 'Combo Master',
    shortLabel: 'x5 combo',
    description: 'Reach a productivity combo of 5.',
  },
  {
    id: 'streak-starter',
    label: 'Streak Starter',
    shortLabel: '3d streak',
    description: 'Maintain a 3-day productivity streak.',
  },
  {
    id: 'streak-keeper',
    label: 'Streak Keeper',
    shortLabel: '7d streak',
    description: 'Maintain a 7-day productivity streak.',
  },
  {
    id: 'error-taster',
    label: 'Error Taster',
    shortLabel: '10 feeds',
    description: 'Feed your buddy 10 real tool failures.',
  },
  {
    id: 'deep-work',
    label: 'Deep Work',
    shortLabel: '30m work',
    description: 'Accumulate 30 minutes of productive tool time.',
  },
  {
    id: 'centurion',
    label: 'Centurion',
    shortLabel: '100 turns',
    description: 'Reach 100 productive turns.',
  },
]

function createEmptyBuddyProgress(): BuddyProgress {
  return {
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
    version: BUDDY_PROGRESS_VERSION,
  }
}

function getDayBucket(at: number): number {
  const date = new Date(at)
  date.setHours(0, 0, 0, 0)
  return Math.floor(date.getTime() / DAY_MS)
}

function hasWorkHistory(progress: BuddyProgress): boolean {
  return (
    progress.productiveTurns > 0 ||
    progress.workDurationMs > 0 ||
    progress.lastWorkAt !== undefined ||
    progress.recentWorkAts.length > 0
  )
}

function getAchievementUnlocked(
  progress: BuddyProgress,
  achievementId: BuddyAchievementId,
): boolean {
  switch (achievementId) {
    case 'first-productive-turn':
      return progress.productiveTurns >= 1
    case 'combo-starter':
      return progress.bestCombo >= 2
    case 'combo-master':
      return progress.bestCombo >= 5
    case 'streak-starter':
      return progress.bestStreak >= 3
    case 'streak-keeper':
      return progress.bestStreak >= 7
    case 'error-taster':
      return progress.errorFeeds >= 10
    case 'deep-work':
      return progress.workDurationMs >= 30 * 60 * 1000
    case 'centurion':
      return progress.productiveTurns >= 100
    default: {
      const _exhaustive: never = achievementId
      return _exhaustive
    }
  }
}

export function createDefaultBuddyProgress(_now = Date.now()): BuddyProgress {
  return createEmptyBuddyProgress()
}

export function getBuddyProgress(
  stored: Pick<StoredCompanion, 'progress'>,
): BuddyProgress {
  const progress = stored.progress
  if (!progress) {
    return createEmptyBuddyProgress()
  }

  const isLegacyProductivityProgress = (progress.version ?? 0) < BUDDY_PROGRESS_VERSION

  return {
    xpTotal: progress.xpTotal,
    promptTurns: progress.promptTurns,
    productiveTurns: isLegacyProductivityProgress ? 0 : (progress.productiveTurns ?? 0),
    workDurationMs: isLegacyProductivityProgress ? 0 : (progress.workDurationMs ?? 0),
    errorFeeds: progress.errorFeeds ?? 0,
    currentStreak: isLegacyProductivityProgress ? 0 : (progress.currentStreak ?? 0),
    bestStreak: isLegacyProductivityProgress ? 0 : (progress.bestStreak ?? progress.currentStreak ?? 0),
    currentCombo: isLegacyProductivityProgress ? 0 : (progress.currentCombo ?? 0),
    bestCombo: isLegacyProductivityProgress ? 0 : (progress.bestCombo ?? progress.currentCombo ?? 0),
    highestStatMilestone: progress.highestStatMilestone ?? 0,
    statBonuses: progress.statBonuses,
    lastPromptAt: progress.lastPromptAt,
    lastWorkAt: isLegacyProductivityProgress ? undefined : progress.lastWorkAt,
    lastComboAt: isLegacyProductivityProgress ? undefined : progress.lastComboAt,
    lastStreakDay: isLegacyProductivityProgress ? undefined : progress.lastStreakDay,
    recentPromptTurnAts: progress.recentPromptTurnAts ?? [],
    recentWorkAts: isLegacyProductivityProgress ? [] : (progress.recentWorkAts ?? []),
    recentErrorFeedKeys: progress.recentErrorFeedKeys ?? [],
    version: BUDDY_PROGRESS_VERSION,
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
  const useWorkSignals = hasWorkHistory(progress)
  const recentActivity = (useWorkSignals ? progress.recentWorkAts : progress.recentPromptTurnAts)
    .filter(ts => now - ts <= DAY_MS)
  const lastActivityAt = useWorkSignals ? progress.lastWorkAt : progress.lastPromptAt

  if (lastActivityAt === undefined) {
    return 'lonely'
  }

  const age = now - lastActivityAt
  if (age <= DAY_MS) {
    return recentActivity.length >= 2 || progress.currentCombo >= 2
      ? 'excited'
      : 'content'
  }

  if (age <= 3 * DAY_MS) {
    return 'content'
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
  const mood = getBuddyMood(progress, now)
  const value =
    mood === 'excited' ? 4
      : mood === 'content' ? 3
      : mood === 'sleepy' ? 1
      : 0

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

export function getBuddyComboBonusXp(currentCombo: number): number {
  if (currentCombo < 2) {
    return 0
  }

  return Math.min(MAX_COMBO_BONUS_XP, currentCombo - 1)
}

export function getBuddyPromptTurnXp(tokenUsage = 0): number {
  return PROMPT_TURN_XP + getBuddyPromptTurnBonusXp(tokenUsage)
}

export function getBuddyAchievements(progress: BuddyProgress): BuddyAchievement[] {
  return BUDDY_ACHIEVEMENTS.filter(achievement =>
    getAchievementUnlocked(progress, achievement.id),
  )
}

export function getBuddyAchievementCount(progress: BuddyProgress): number {
  return getBuddyAchievements(progress).length
}

export function getNextBuddyAchievements(
  progress: BuddyProgress,
  limit = 3,
): BuddyAchievement[] {
  return BUDDY_ACHIEVEMENTS.filter(
    achievement => !getAchievementUnlocked(progress, achievement.id),
  ).slice(0, limit)
}

export function formatBuddyWorkDuration(durationMs: number): string {
  if (durationMs <= 0) {
    return '0m'
  }

  const totalMinutes = Math.max(1, Math.round(durationMs / 60000))
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60

  if (hours === 0) {
    return `${totalMinutes}m`
  }

  if (minutes === 0) {
    return `${hours}h`
  }

  return `${hours}h ${minutes}m`
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
        lastPromptAt: event.at,
        recentPromptTurnAts,
        version: BUDDY_PROGRESS_VERSION,
      }
    }
    case 'productive_turn': {
      if (event.toolSuccesses <= 0) {
        return {
          ...progress,
          version: BUDDY_PROGRESS_VERSION,
        }
      }

      const recentWorkAts = [...progress.recentWorkAts, event.at]
        .filter(ts => event.at - ts <= 7 * DAY_MS)
        .slice(-RECENT_HISTORY_LIMIT)
      const durationMs = Math.max(0, event.toolDurationMs)
      const withinComboWindow =
        progress.lastComboAt !== undefined &&
        event.at - progress.lastComboAt <= COMBO_WINDOW_MS
      const currentCombo = withinComboWindow
        ? Math.max(2, progress.currentCombo + 1)
        : 1
      const bestCombo = Math.max(progress.bestCombo, currentCombo)
      const streakDay = getDayBucket(event.at)

      let currentStreak = progress.currentStreak
      if (progress.lastStreakDay === undefined) {
        currentStreak = 1
      } else if (progress.lastStreakDay === streakDay) {
        currentStreak = progress.currentStreak
      } else if (progress.lastStreakDay === streakDay - 1) {
        currentStreak = progress.currentStreak + 1
      } else {
        currentStreak = 1
      }

      return {
        ...progress,
        productiveTurns: progress.productiveTurns + 1,
        workDurationMs: progress.workDurationMs + durationMs,
        currentStreak,
        bestStreak: Math.max(progress.bestStreak, currentStreak),
        currentCombo,
        bestCombo,
        lastWorkAt: event.at,
        lastComboAt: event.at,
        lastStreakDay: streakDay,
        recentWorkAts,
        version: BUDDY_PROGRESS_VERSION,
      }
    }
    case 'prompt_turn_bonus': {
      if (event.xp <= 0) {
        return {
          ...progress,
          version: BUDDY_PROGRESS_VERSION,
        }
      }

      return {
        ...progress,
        xpTotal: progress.xpTotal + event.xp,
        version: BUDDY_PROGRESS_VERSION,
      }
    }
    case 'tool_error': {
      if (progress.recentErrorFeedKeys.includes(event.feedKey)) {
        return {
          ...progress,
          version: BUDDY_PROGRESS_VERSION,
        }
      }

      return {
        ...progress,
        xpTotal: progress.xpTotal + ERROR_FEED_XP,
        errorFeeds: progress.errorFeeds + 1,
        recentErrorFeedKeys: [...progress.recentErrorFeedKeys, event.feedKey].slice(
          -RECENT_ERROR_FEED_LIMIT,
        ),
        version: BUDDY_PROGRESS_VERSION,
      }
    }
    default: {
      const _exhaustive: never = event
      return progress
    }
  }
}
