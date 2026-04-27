import type { GlobalConfig } from '../utils/config.js'
import { safeParseJSON } from '../utils/json.js'
import { jsonStringify } from '../utils/slowOperations.js'
import { getBuddyLevelProgress, getBuddyProgress } from './progression.js'
import {
  isValidBuddyMode,
  STAT_NAMES,
  type BuddyMode,
  type BuddyProgress,
  type StatName,
  type StoredCompanion,
} from './types.js'

export const BUDDY_EXPORT_FORMAT = 'codex3d.buddy.export'
export const BUDDY_EXPORT_VERSION = 1

const MAX_BUDDY_NAME_LENGTH = 32
const MAX_BUDDY_PERSONALITY_LENGTH = 160
const MAX_BUDDY_SEED_LENGTH = 256
const MAX_ERROR_FEED_KEY_LENGTH = 512
const RECENT_HISTORY_LIMIT = 20
const RECENT_ERROR_FEED_LIMIT = 20

export type BuddyExportData = {
  format: typeof BUDDY_EXPORT_FORMAT
  version: typeof BUDDY_EXPORT_VERSION
  exportedAt: number
  companion: StoredCompanion
  companionMuted?: boolean
  companionMode?: BuddyMode
}

export type BuddyTransferResult<T> =
  | { ok: true; value: T; warnings: string[] }
  | { ok: false; error: string }

export type BuddyExportConfig = Pick<
  GlobalConfig,
  'companion' | 'companionMuted' | 'companionMode'
>

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function isFiniteNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && Number.isFinite(value)
}

function normalizeText(value: string): string {
  return value.trim().replace(/\s+/g, ' ')
}

function validateBoundedText(
  value: unknown,
  label: string,
  maxLength: number,
): BuddyTransferResult<string> {
  if (typeof value !== 'string') {
    return { ok: false, error: `${label} must be a string.` }
  }
  const normalized = normalizeText(value)
  if (!normalized) {
    return { ok: false, error: `${label} must not be empty.` }
  }
  if (normalized.length > maxLength) {
    return { ok: false, error: `${label} must be ${maxLength} characters or fewer.` }
  }
  return { ok: true, value: normalized, warnings: [] }
}

function validateOptionalTimestamp(
  value: unknown,
  label: string,
): BuddyTransferResult<number | undefined> {
  if (value === undefined) {
    return { ok: true, value: undefined, warnings: [] }
  }
  if (!isFiniteNonNegativeInteger(value)) {
    return { ok: false, error: `${label} must be a non-negative integer timestamp.` }
  }
  return { ok: true, value, warnings: [] }
}

function validateTimestampArray(
  value: unknown,
  label: string,
): BuddyTransferResult<number[]> {
  if (value === undefined) {
    return { ok: true, value: [], warnings: [] }
  }
  if (!Array.isArray(value)) {
    return { ok: false, error: `${label} must be an array.` }
  }
  const timestamps: number[] = []
  for (const item of value) {
    if (!isFiniteNonNegativeInteger(item)) {
      return { ok: false, error: `${label} must contain only non-negative integer timestamps.` }
    }
    timestamps.push(item)
  }
  return { ok: true, value: timestamps.slice(-RECENT_HISTORY_LIMIT), warnings: [] }
}

function validateErrorFeedKeys(value: unknown): BuddyTransferResult<string[]> {
  if (value === undefined) {
    return { ok: true, value: [], warnings: [] }
  }
  if (!Array.isArray(value)) {
    return { ok: false, error: 'recentErrorFeedKeys must be an array.' }
  }
  const keys: string[] = []
  for (const item of value) {
    if (typeof item !== 'string') {
      return { ok: false, error: 'recentErrorFeedKeys must contain only strings.' }
    }
    if (item.length > MAX_ERROR_FEED_KEY_LENGTH) {
      return { ok: false, error: `recentErrorFeedKeys entries must be ${MAX_ERROR_FEED_KEY_LENGTH} characters or fewer.` }
    }
    keys.push(item)
  }
  return { ok: true, value: keys.slice(-RECENT_ERROR_FEED_LIMIT), warnings: [] }
}

function validateStatBonuses(value: unknown): BuddyTransferResult<Partial<Record<StatName, number>> | undefined> {
  if (value === undefined) {
    return { ok: true, value: undefined, warnings: [] }
  }
  if (!isRecord(value)) {
    return { ok: false, error: 'statBonuses must be an object.' }
  }
  const bonuses: Partial<Record<StatName, number>> = {}
  for (const [key, bonus] of Object.entries(value)) {
    if (!STAT_NAMES.includes(key as StatName)) {
      return { ok: false, error: `Invalid stat bonus: ${key}.` }
    }
    if (typeof bonus !== 'number' || !Number.isFinite(bonus)) {
      return { ok: false, error: `Stat bonus ${key} must be a finite number.` }
    }
    bonuses[key as StatName] = bonus
  }
  return { ok: true, value: Object.keys(bonuses).length > 0 ? bonuses : undefined, warnings: [] }
}

function validateProgressCounter(
  progress: Record<string, unknown>,
  key: keyof BuddyProgress,
): BuddyTransferResult<number> {
  const value = progress[key]
  if (!isFiniteNonNegativeInteger(value)) {
    return { ok: false, error: `${String(key)} must be a non-negative integer.` }
  }
  return { ok: true, value, warnings: [] }
}

export function validateBuddyProgress(value: unknown): BuddyTransferResult<BuddyProgress | undefined> {
  if (value === undefined) {
    return { ok: true, value: undefined, warnings: [] }
  }
  if (!isRecord(value)) {
    return { ok: false, error: 'progress must be an object.' }
  }

  const counters = [
    'xpTotal',
    'promptTurns',
    'productiveTurns',
    'workDurationMs',
    'errorFeeds',
    'currentStreak',
    'bestStreak',
    'currentCombo',
    'bestCombo',
    'highestStatMilestone',
  ] as const
  const progress = {} as BuddyProgress
  for (const key of counters) {
    const result = validateProgressCounter(value, key)
    if (!result.ok) return result
    progress[key] = result.value
  }

  const statBonuses = validateStatBonuses(value.statBonuses)
  if (!statBonuses.ok) return statBonuses
  progress.statBonuses = statBonuses.value

  for (const key of ['lastPromptAt', 'lastWorkAt', 'lastComboAt', 'lastStreakDay'] as const) {
    const result = validateOptionalTimestamp(value[key], key)
    if (!result.ok) return result
    progress[key] = result.value
  }

  const recentPromptTurnAts = validateTimestampArray(value.recentPromptTurnAts, 'recentPromptTurnAts')
  if (!recentPromptTurnAts.ok) return recentPromptTurnAts
  progress.recentPromptTurnAts = recentPromptTurnAts.value

  const recentWorkAts = validateTimestampArray(value.recentWorkAts, 'recentWorkAts')
  if (!recentWorkAts.ok) return recentWorkAts
  progress.recentWorkAts = recentWorkAts.value

  const recentErrorFeedKeys = validateErrorFeedKeys(value.recentErrorFeedKeys)
  if (!recentErrorFeedKeys.ok) return recentErrorFeedKeys
  progress.recentErrorFeedKeys = recentErrorFeedKeys.value

  const version = value.version
  if (!isFiniteNonNegativeInteger(version)) {
    return { ok: false, error: 'version must be a non-negative integer.' }
  }
  progress.version = version

  return { ok: true, value: getBuddyProgress({ progress }), warnings: [] }
}

export function validateStoredCompanion(value: unknown): BuddyTransferResult<StoredCompanion> {
  if (!isRecord(value)) {
    return { ok: false, error: 'companion must be an object.' }
  }

  const name = validateBoundedText(value.name, 'Buddy name', MAX_BUDDY_NAME_LENGTH)
  if (!name.ok) return name

  const personality = validateBoundedText(
    value.personality,
    'Buddy personality',
    MAX_BUDDY_PERSONALITY_LENGTH,
  )
  if (!personality.ok) return personality

  if (!isFiniteNonNegativeInteger(value.hatchedAt)) {
    return { ok: false, error: 'hatchedAt must be a non-negative integer timestamp.' }
  }

  const stored: StoredCompanion = {
    name: name.value,
    personality: personality.value,
    hatchedAt: value.hatchedAt,
  }
  const warnings: string[] = []

  if (value.seed !== undefined) {
    const seed = validateBoundedText(value.seed, 'Buddy seed', MAX_BUDDY_SEED_LENGTH)
    if (!seed.ok) return seed
    stored.seed = seed.value
  } else {
    warnings.push('This buddy has no seed, so appearance may not transfer exactly.')
  }

  const progress = validateBuddyProgress(value.progress)
  if (!progress.ok) return progress
  stored.progress = progress.value ?? getBuddyProgress({})

  return { ok: true, value: stored, warnings }
}

export function createBuddyExport(
  config: BuddyExportConfig,
  exportedAt = Date.now(),
): BuddyTransferResult<BuddyExportData> {
  if (!config.companion) {
    return { ok: false, error: 'No buddy hatched yet. Run /buddy to hatch one.' }
  }
  if (!isFiniteNonNegativeInteger(exportedAt)) {
    return { ok: false, error: 'exportedAt must be a non-negative integer timestamp.' }
  }

  const companion = validateStoredCompanion({
    ...config.companion,
    progress: getBuddyProgress(config.companion),
  })
  if (!companion.ok) return companion

  const exportData: BuddyExportData = {
    format: BUDDY_EXPORT_FORMAT,
    version: BUDDY_EXPORT_VERSION,
    exportedAt,
    companion: companion.value,
  }
  if (config.companionMuted !== undefined) {
    exportData.companionMuted = config.companionMuted
  }
  if (config.companionMode !== undefined) {
    if (!isValidBuddyMode(config.companionMode)) {
      return { ok: false, error: 'Current buddy mode is invalid.' }
    }
    exportData.companionMode = config.companionMode
  }

  return { ok: true, value: exportData, warnings: companion.warnings }
}

export function serializeBuddyExport(exportData: BuddyExportData): string {
  return `${jsonStringify(exportData, null, 2)}\n`
}

export function parseBuddyExport(raw: string): BuddyTransferResult<BuddyExportData> {
  if (!raw.trim()) {
    return { ok: false, error: 'Buddy export file is empty.' }
  }
  const parsed = safeParseJSON(raw, false)
  if (!isRecord(parsed)) {
    return { ok: false, error: 'Buddy export file must contain a JSON object.' }
  }
  if (parsed.format !== BUDDY_EXPORT_FORMAT) {
    return { ok: false, error: 'Unsupported buddy export format.' }
  }
  if (parsed.version !== BUDDY_EXPORT_VERSION) {
    return { ok: false, error: 'Unsupported buddy export version.' }
  }
  if (!isFiniteNonNegativeInteger(parsed.exportedAt)) {
    return { ok: false, error: 'exportedAt must be a non-negative integer timestamp.' }
  }

  const companion = validateStoredCompanion(parsed.companion)
  if (!companion.ok) return companion

  const exportData: BuddyExportData = {
    format: BUDDY_EXPORT_FORMAT,
    version: BUDDY_EXPORT_VERSION,
    exportedAt: parsed.exportedAt,
    companion: companion.value,
  }
  if (parsed.companionMuted !== undefined) {
    if (typeof parsed.companionMuted !== 'boolean') {
      return { ok: false, error: 'companionMuted must be a boolean.' }
    }
    exportData.companionMuted = parsed.companionMuted
  }
  if (parsed.companionMode !== undefined) {
    if (typeof parsed.companionMode !== 'string' || !isValidBuddyMode(parsed.companionMode)) {
      return { ok: false, error: 'companionMode must be minimal, balanced, or expressive.' }
    }
    exportData.companionMode = parsed.companionMode
  }

  return { ok: true, value: exportData, warnings: companion.warnings }
}

export function summarizeBuddyExport(exportData: BuddyExportData): string {
  const progress = getBuddyProgress(exportData.companion)
  const level = getBuddyLevelProgress(progress.xpTotal).level
  return `${exportData.companion.name} · Level ${level} · ${progress.xpTotal} XP`
}
