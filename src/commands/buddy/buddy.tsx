import { randomUUID } from 'crypto'
import { constants } from 'fs'
import { access, readFile, stat, writeFile } from 'fs/promises'
import { join, resolve } from 'path'
import type { LocalJSXCommandContext, LocalJSXCommandOnDone } from '../../types/command.js'
import { stringWidth } from '../../ink/stringWidth.js'
import { getGlobalConfig, saveGlobalConfig } from '../../utils/config.js'
import { getCwd } from '../../utils/cwd.js'
import { truncateToWidth } from '../../utils/truncate.js'
import {
  companionUserId,
  getCompanion,
  getCompanionFromStored,
} from '../../buddy/companion.js'
import type {
  BuddyMode,
  BuddyProductiveTurnSummary,
  Companion,
  StoredCompanion,
} from '../../buddy/types.js'
import {
  formatBuddyMode,
  getBuddyMode,
  getBuddyModeChoiceText,
  getBuddyModeDescription,
  getBuddyModeHelp,
  getBuddyModeStatus,
  normalizeBuddyMode,
  RARITY_STARS,
} from '../../buddy/types.js'
import {
  applyBuddyProgressEvent,
  createDefaultBuddyProgress,
  formatBuddyWorkDuration,
  getBuddyAchievementCount,
  getBuddyAchievements,
  getBuddyComboBonusXp,
  getBuddyLevelProgress,
  getBuddyLevelProgressBar,
  getBuddyMoodBar,
  getBuddyMoodDisplay,
  getBuddyProgress,
  getBuddyPromptTurnBonusXp,
  getNextBuddyAchievements,
} from '../../buddy/progression.js'
import {
  BUDDY_LIFECYCLE_PHRASES,
  BUDDY_MANUAL_PET_PHRASES,
  BUDDY_PROGRESS_PHRASES,
  BUDDY_TOOL_ERROR_PHRASES,
  formatBuddyPhrase,
  pickBuddyPhrase,
} from '../../buddy/phrases.js'
import {
  createBuddyExport,
  parseBuddyExport,
  serializeBuddyExport,
  summarizeBuddyExport,
} from '../../buddy/transfer.js'
import type { BuddyExportData } from '../../buddy/transfer.js'
import type { CompanionAnimationKind } from '../../buddy/visualState.js'
import { COMMON_HELP_ARGS, COMMON_INFO_ARGS } from '../../constants/xml.js'

const NAME_PREFIXES = [
  'Byte',
  'Echo',
  'Glint',
  'Miso',
  'Nova',
  'Pixel',
  'Rune',
  'Static',
  'Vector',
  'Whisk',
] as const

const NAME_SUFFIXES = [
  'bean',
  'bit',
  'bud',
  'dot',
  'ling',
  'loop',
  'moss',
  'patch',
  'puff',
  'spark',
] as const

const PERSONALITIES = [
  'Curious and quietly encouraging',
  'A patient little watcher with strong debugging instincts',
  'Playful, observant, and suspicious of flaky tests',
  'Calm under pressure and fond of clean diffs',
  'A tiny terminal gremlin who likes successful builds',
] as const

const MAX_NAME_LENGTH = 32
const MAX_PERSONALITY_LENGTH = 160
const MAX_BUDDY_IMPORT_BYTES = 64 * 1024

function formatBuddyExportTimestamp(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  const seconds = String(date.getSeconds()).padStart(2, '0')
  return `${year}-${month}-${day}-${hours}${minutes}${seconds}`
}

function resolveBuddyTransferPath(pathArg: string): string {
  return resolve(getCwd(), pathArg)
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK)
    return true
  } catch {
    return false
  }
}

function parseBuddyTransferArgs(rawArgs: string): {
  path?: string
  force: boolean
  replace: boolean
  dryRun: boolean
} {
  const parts = rawArgs.split(/\s+/).filter(Boolean)
  const flags = new Set(parts.filter(part => part.startsWith('--')))
  return {
    path: parts.find(part => !part.startsWith('--')),
    force: flags.has('--force'),
    replace: flags.has('--replace'),
    dryRun: flags.has('--dry-run'),
  }
}

async function exportBuddy(onDone: LocalJSXCommandOnDone, rawArgs: string): Promise<void> {
  const { path, force } = parseBuddyTransferArgs(rawArgs)
  const exportResult = createBuddyExport(getGlobalConfig())
  if (!exportResult.ok) {
    onDone(exportResult.error, { display: 'system' })
    return
  }

  const outputPath = path
    ? resolveBuddyTransferPath(path)
    : join(getCwd(), `buddy-export-${formatBuddyExportTimestamp(new Date(exportResult.value.exportedAt))}.json`)

  if (!force && await pathExists(outputPath)) {
    onDone(`Refusing to overwrite existing file: ${outputPath}\nRerun with --force to overwrite it.`, {
      display: 'system',
    })
    return
  }

  try {
    await writeFile(outputPath, serializeBuddyExport(exportResult.value), {
      encoding: 'utf-8',
      flag: force ? 'w' : 'wx',
    })
  } catch (error) {
    const errorCode = error && typeof error === 'object' && 'code' in error
      ? String(error.code)
      : undefined
    if (!force && errorCode === 'EEXIST') {
      onDone(`Refusing to overwrite existing file: ${outputPath}\nRerun with --force to overwrite it.`, {
        display: 'system',
      })
      return
    }
    onDone(`Failed to export buddy: ${error instanceof Error ? error.message : 'Unknown error'}`, {
      display: 'system',
    })
    return
  }

  const warningText = exportResult.warnings.length > 0
    ? `\nWarning: ${exportResult.warnings.join(' ')}`
    : ''
  onDone(
    `Buddy exported to: ${outputPath}${warningText}\nImport with: /buddy import ${outputPath}`,
    { display: 'system' },
  )
}

async function readBuddyImportFile(path: string): Promise<{ ok: true; raw: string } | { ok: false; error: string }> {
  let fileStat
  try {
    fileStat = await stat(path)
  } catch (error) {
    return { ok: false, error: `Failed to read buddy export: ${error instanceof Error ? error.message : 'Unknown error'}` }
  }
  if (!fileStat.isFile()) {
    return { ok: false, error: 'Buddy import path must be a file.' }
  }
  if (fileStat.size > MAX_BUDDY_IMPORT_BYTES) {
    return { ok: false, error: `Buddy export file must be ${MAX_BUDDY_IMPORT_BYTES} bytes or smaller.` }
  }
  if (fileStat.size === 0) {
    return { ok: false, error: 'Buddy export file is empty.' }
  }
  return { ok: true, raw: await readFile(path, 'utf-8') }
}

function applyBuddyImport(exportData: BuddyExportData, replace: boolean): { imported: boolean; current?: StoredCompanion } {
  let currentCompanion: StoredCompanion | undefined
  let imported = false
  saveGlobalConfig(current => {
    if (current.companion && !replace) {
      currentCompanion = current.companion
      return current
    }
    imported = true
    return {
      ...current,
      companion: exportData.companion,
      companionMuted: exportData.companionMuted,
      companionMode: exportData.companionMode,
    }
  })
  return { imported, current: currentCompanion }
}

async function importBuddy(
  onDone: LocalJSXCommandOnDone,
  context: Pick<LocalJSXCommandContext, 'setAppState'>,
  rawArgs: string,
): Promise<void> {
  const { path, replace, dryRun } = parseBuddyTransferArgs(rawArgs)
  if (!path) {
    onDone('Usage: /buddy import <path> [--dry-run|--replace]', { display: 'system' })
    return
  }

  const inputPath = resolveBuddyTransferPath(path)
  const file = await readBuddyImportFile(inputPath)
  if (!file.ok) {
    onDone(file.error, { display: 'system' })
    return
  }

  const parsed = parseBuddyExport(file.raw)
  if (!parsed.ok) {
    onDone(`Invalid buddy export: ${parsed.error}`, { display: 'system' })
    return
  }

  const incomingSummary = summarizeBuddyExport(parsed.value)
  const warningText = parsed.warnings.length > 0
    ? `\nWarning: ${parsed.warnings.join(' ')}`
    : ''

  if (dryRun) {
    onDone(`Buddy export is valid: ${incomingSummary}${warningText}`, { display: 'system' })
    return
  }

  const result = applyBuddyImport(parsed.value, replace)
  if (!result.imported && result.current) {
    const currentSummary = summarizeBuddyExport({
      ...parsed.value,
      companion: result.current,
    })
    onDone(
      `A buddy already exists.\nCurrent: ${currentSummary}\nImport: ${incomingSummary}\nRerun with --replace to replace your current buddy.`,
      { display: 'system' },
    )
    return
  }

  setCompanionReaction(context, undefined)
  onDone(`Buddy imported: ${incomingSummary}${warningText}`, { display: 'system' })
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

function titleCase(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function createCompanionSeed(): string {
  return `${companionUserId()}:${randomUUID()}`
}

function createStoredCompanion(seed = createCompanionSeed()): StoredCompanion {
  const prefix = pickDeterministic(NAME_PREFIXES, `${seed}:prefix`)
  const suffix = pickDeterministic(NAME_SUFFIXES, `${seed}:suffix`)
  const personality = pickDeterministic(PERSONALITIES, `${seed}:personality`)
  const now = Date.now()

  return {
    seed,
    name: `${prefix}${suffix}`,
    personality: `${personality}.`,
    hatchedAt: now,
    progress: createDefaultBuddyProgress(now),
  }
}

export function setCompanionReaction(
  context: Pick<LocalJSXCommandContext, 'setAppState'>,
  reaction: string | undefined,
  pet = false,
  kind: CompanionAnimationKind = pet ? 'pet' : reaction ? 'speak' : 'idle',
): void {
  const now = Date.now()
  context.setAppState(prev => ({
    ...prev,
    companionReaction: reaction,
    companionPetAt: pet ? now : prev.companionPetAt,
    companionAnimation:
      reaction || pet
        ? {
            kind,
            at: now,
          }
        : prev.companionAnimation,
  }))
}

function setBuddyXpGain(
  context: Pick<LocalJSXCommandContext, 'setAppState'>,
  xpGain: number | undefined,
): void {
  context.setAppState(prev => ({
    ...prev,
    lastBuddyXpGain: xpGain,
  }))
}

function buildErrorFeedKey(parts: {
  chainId?: string
  requestId?: string
  toolName: string
  errorClass: string
}): string {
  return `${parts.chainId ?? parts.requestId ?? 'tool'}:${parts.toolName}:${parts.errorClass}`
}

export function awardBuddyToolError(
  context: Pick<LocalJSXCommandContext, 'setAppState'>,
  parts: {
    chainId?: string
    requestId?: string
    toolName: string
    errorClass: string
  },
  now = Date.now(),
): Companion | undefined {
  const stored = getStoredCompanion()
  if (!stored) {
    return undefined
  }

  const currentProgress = getBuddyProgress(stored)
  const nextProgress = applyBuddyProgressEvent(currentProgress, {
    type: 'tool_error',
    at: now,
    feedKey: buildErrorFeedKey(parts),
  })

  if (
    nextProgress.xpTotal === currentProgress.xpTotal &&
    nextProgress.errorFeeds === currentProgress.errorFeeds
  ) {
    return getCompanionFromStored({
      ...stored,
      progress: nextProgress,
    })
  }

  const nextStored = {
    ...stored,
    progress: nextProgress,
  }

  saveGlobalConfig(current => ({
    ...current,
    companion: nextStored,
  }))

  const companion = getCompanionFromStored(nextStored)
  if (!getGlobalConfig().companionMuted) {
    setCompanionReaction(
      context,
      createErrorFeedMessage(companion.name, parts.toolName),
      false,
      'errorFeed',
    )
  }
  return companion
}

function createErrorFeedMessage(name: string, toolName: string): string {
  return formatBuddyPhrase(
    pickBuddyPhrase(BUDDY_TOOL_ERROR_PHRASES, `${name}:${toolName}`),
    { name, toolName },
  )
}

function renderHelp(): string {
  return `Usage: /buddy [status|mode <minimal|balanced|expressive>|rename <name>|edit personality <text>|export [path] [--force]|import <path> [--dry-run|--replace]|reset|reroll|mute|unmute|help]

Manage your one active buddy.

${getBuddyModeHelp()}

Transfer your buddy with /buddy export [path] and /buddy import <path>.

Run /buddy with no args to hatch your companion the first time, then pet them on later runs.`
}

function showHelp(onDone: LocalJSXCommandOnDone): void {
  onDone(renderHelp(), { display: 'system' })
}

function showNoBuddy(onDone: LocalJSXCommandOnDone): void {
  onDone('No buddy hatched yet. Run /buddy to hatch one.', {
    display: 'system',
  })
}

function showUnknownSubcommand(
  onDone: LocalJSXCommandOnDone,
  subcommand: string,
): void {
  onDone(`Unknown buddy subcommand: ${subcommand}\n\n${renderHelp()}`, {
    display: 'system',
  })
}

type StatusStatRow = {
  label: string
  bar: string
  value: number
  tone: string
}

type StatusMetricRow = {
  leftLabel: string
  leftValue: string
  centerLabel?: string
  centerValue?: string
  rightLabel?: string
  rightValue?: string
}

const STATUS_MIN_INNER_WIDTH = 38
const STATUS_DEFAULT_INNER_WIDTH = 60
const STATUS_WIDE_BREAKPOINT = 54
const STATUS_BAR_WIDTH = 10

function statBar(value: number, width = STATUS_BAR_WIDTH): string {
  const filled = Math.max(0, Math.min(width, Math.round((value / 100) * width)))
  return `${'█'.repeat(filled)}${'░'.repeat(width - filled)}`
}

function padDisplay(text: string, width: number): string {
  const safe = stringWidth(text) > width ? truncateToWidth(text, width) : text
  return safe + ' '.repeat(Math.max(0, width - stringWidth(safe)))
}

function formatCell(label: string, value: string, width: number): string {
  const normalizedLabel = label.toUpperCase()
  const labelWidth = Math.min(Math.max(stringWidth(normalizedLabel), 4), Math.max(4, width - 2))
  const valueWidth = Math.max(0, width - labelWidth - 1)
  return `${padDisplay(normalizedLabel, labelWidth)} ${padDisplay(value, valueWidth)}`
}

function joinColumns(columns: string[], innerWidth: number): string {
  if (columns.length === 1) {
    return padDisplay(columns[0]!, innerWidth)
  }

  const gap = '  '
  const available = innerWidth - gap.length * (columns.length - 1)
  const base = Math.floor(available / columns.length)
  const widths = Array.from({ length: columns.length }, (_, index) =>
    base + (index < available % columns.length ? 1 : 0),
  )

  return columns.map((column, index) => padDisplay(column, widths[index]!)).join(gap)
}

function renderMetricRow(row: StatusMetricRow, innerWidth: number): string {
  const entries = [
    { label: row.leftLabel, value: row.leftValue },
    ...(row.centerLabel && row.centerValue
      ? [{ label: row.centerLabel, value: row.centerValue }]
      : []),
    ...(row.rightLabel && row.rightValue
      ? [{ label: row.rightLabel, value: row.rightValue }]
      : []),
  ]

  if (innerWidth < STATUS_WIDE_BREAKPOINT && entries.length > 1) {
    return entries.map(entry => formatCell(entry.label, entry.value, innerWidth)).join('\n')
  }

  const gap = '  '
  const available = innerWidth - gap.length * (entries.length - 1)
  const baseWidth = Math.floor(available / entries.length)
  const widths = Array.from({ length: entries.length }, (_, index) =>
    baseWidth + (index < available % entries.length ? 1 : 0),
  )

  return entries.map((entry, index) => formatCell(entry.label, entry.value, widths[index]!)).join(gap)
}

function renderMetricRows(rows: StatusMetricRow[], innerWidth: number): string[] {
  const lines: string[] = []

  for (const row of rows) {
    const rendered = renderMetricRow(row, innerWidth)
    lines.push(...rendered.split('\n').map(line => padDisplay(line, innerWidth)))
  }

  return lines
}

function renderStatusSectionDivider(innerWidth: number): string {
  return `├${'─'.repeat(innerWidth + 2)}┤`
}

function renderStatusTop(
  companion: Companion,
  raritySpecies: string,
  subtitle: string,
  innerWidth: number,
  wide: boolean,
): string[] {
  const lines: string[] = []
  lines.push(
    wide
      ? joinColumns([companion.name.toUpperCase(), `${titleCase(companion.rarity).toUpperCase()} ${titleCase(companion.species).toUpperCase()}`], innerWidth)
      : padDisplay(companion.name.toUpperCase(), innerWidth),
  )
  if (!wide) {
    lines.push(padDisplay(`${titleCase(companion.rarity).toUpperCase()} ${titleCase(companion.species).toUpperCase()}`, innerWidth))
  }
  lines.push(padDisplay(truncateToWidth(subtitle, innerWidth), innerWidth))
  return lines
}

function getTraitTone(name: string, value: number): string {
  if (name === 'CHAOS') {
    if (value >= 75) return 'WILD'
    if (value >= 45) return 'SPICY'
    if (value >= 20) return 'RESTLESS'
    return 'CALM'
  }

  if (value >= 80) return 'ELITE'
  if (value >= 60) {
    return name === 'WISDOM' ? 'SHARP' : name === 'SNARK' ? 'CUTTING' : 'STRONG'
  }
  if (value >= 40) {
    return name === 'PATIENCE' ? 'STEADY' : 'BALANCED'
  }
  if (value >= 20) {
    return name === 'DEBUGGING' ? 'CURIOUS' : name === 'SNARK' ? 'MILD' : 'RISING'
  }
  return 'QUIET'
}

function renderTraitRow(stat: StatusStatRow, innerWidth: number): string {
  const score = String(stat.value).padStart(2, '0')
  return padDisplay(`${padDisplay(stat.label, 12)} ${stat.bar} ${score}   ${stat.tone}`, innerWidth)
}

function renderFullWidthRow(label: string, value: string, innerWidth: number): string {
  const prefix = `${label.toUpperCase()} `
  const available = Math.max(0, innerWidth - stringWidth(prefix))
  return padDisplay(prefix + truncateToWidth(value, available), innerWidth)
}

function renderStatusLines(
  companion: Companion,
  subtitle: string,
  metrics: StatusMetricRow[],
  stats: StatusStatRow[],
  badges: string,
  next: string,
  innerWidth: number,
  wide: boolean,
): string[] {
  const lines: string[] = [...renderStatusTop(companion, '', subtitle, innerWidth, wide)]
  lines.push(renderStatusSectionDivider(innerWidth))
  lines.push(...renderMetricRows(metrics, innerWidth))
  lines.push(renderStatusSectionDivider(innerWidth))
  lines.push(renderFullWidthRow('BADGES', badges, innerWidth))
  lines.push(renderFullWidthRow('NEXT', next, innerWidth))
  lines.push(renderStatusSectionDivider(innerWidth))
  for (const stat of stats) lines.push(renderTraitRow(stat, innerWidth))
  return lines
}

function formatStatus(companion: Companion): string {
  const mode = getBuddyMode(getGlobalConfig())
  const levelProgress = getBuddyLevelProgress(companion.progress.xpTotal)
  const achievementCount = getBuddyAchievementCount(companion.progress)
  const earnedAchievements = getBuddyAchievements(companion.progress)
  const nextAchievements = getNextBuddyAchievements(companion.progress, 2)
  const innerWidth = Math.max(
    STATUS_MIN_INNER_WIDTH,
    Math.min(STATUS_DEFAULT_INNER_WIDTH, (process.stdout.columns ?? 80) - 4),
  )
  const wide = innerWidth >= STATUS_WIDE_BREAKPOINT
  const subtitle = `${companion.personality.replace(/[.!?]+$/, '')} · ${formatBuddyMode(mode)}`
  const metrics: StatusMetricRow[] = [
    {
      leftLabel: 'LVL',
      leftValue: String(companion.level),
      centerLabel: 'XP',
      centerValue: String(companion.progress.xpTotal),
      rightLabel: 'MOOD',
      rightValue: getBuddyMoodDisplay(companion.mood).replace(/^…\s*/, ''),
    },
    {
      leftLabel: 'EMOTION',
      leftValue: getBuddyMoodBar(companion.progress),
      centerLabel: 'COMBO',
      centerValue: `x${companion.progress.currentCombo} · BEST x${companion.progress.bestCombo}`,
    },
    {
      leftLabel: 'XP BAR',
      leftValue: `${getBuddyLevelProgressBar(companion.progress.xpTotal)} ${levelProgress.xpIntoLevel}/${levelProgress.xpNeededThisLevel} · ${levelProgress.xpRemaining} LEFT`,
    },
    {
      leftLabel: 'PROMPTS',
      leftValue: String(companion.progress.promptTurns),
      centerLabel: 'PRODUCTIVE',
      centerValue: String(companion.progress.productiveTurns),
    },
    {
      leftLabel: 'WORK',
      leftValue: formatBuddyWorkDuration(companion.progress.workDurationMs),
      centerLabel: 'STREAK',
      centerValue: `${companion.progress.currentStreak}d · BEST ${companion.progress.bestStreak}d`,
    },
    {
      leftLabel: 'ERR FEEDS',
      leftValue: String(companion.progress.errorFeeds),
      centerLabel: 'ACHIEVEMENTS',
      centerValue: String(achievementCount),
    },
  ]
  const stats = Object.entries(companion.stats).map(([name, value]) => ({
    label: name,
    bar: statBar(value),
    value,
    tone: getTraitTone(name, value),
  }))
  const badges =
    earnedAchievements.length > 0
      ? earnedAchievements.slice(0, 3).map(achievement => achievement.shortLabel).join(' · ')
      : 'None yet'
  const next =
    nextAchievements.length > 0
      ? nextAchievements.map(achievement => achievement.shortLabel).join(' · ')
      : 'All earned'

  const lines = renderStatusLines(companion, subtitle, metrics, stats, badges, next, innerWidth, wide)
  const top = `┌${'─'.repeat(innerWidth + 2)}┐`
  const middle = lines.map(line =>
    line.startsWith('├') && line.endsWith('┤') ? line : `│ ${padDisplay(line, innerWidth)} │`,
  )
  const bottom = `└${'─'.repeat(innerWidth + 2)}┘`
  return [top, ...middle, bottom].join('\n')
}

function getStatusNote(_companion: Companion): string | undefined {
  return undefined
}

void getStatusNote
void RARITY_STARS

function normalizeText(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ')
}

function validateName(onDone: LocalJSXCommandOnDone, raw: string): string | undefined {
  const name = normalizeText(raw)
  if (!name) {
    onDone('Usage: /buddy rename <name>', { display: 'system' })
    return undefined
  }
  if (name.length > MAX_NAME_LENGTH) {
    onDone(`Buddy names must be ${MAX_NAME_LENGTH} characters or fewer.`, {
      display: 'system',
    })
    return undefined
  }
  return name
}

function validatePersonality(
  onDone: LocalJSXCommandOnDone,
  raw: string,
): string | undefined {
  const personality = normalizeText(raw)
  if (!personality) {
    onDone('Usage: /buddy edit personality <text>', { display: 'system' })
    return undefined
  }
  if (personality.length > MAX_PERSONALITY_LENGTH) {
    onDone(
      `Buddy personalities must be ${MAX_PERSONALITY_LENGTH} characters or fewer.`,
      { display: 'system' },
    )
    return undefined
  }
  return /[.!?]$/.test(personality) ? personality : `${personality}.`
}

function getStoredCompanion(): StoredCompanion | undefined {
  return getGlobalConfig().companion
}

function saveBuddy(stored: StoredCompanion, unmute = false): Companion {
  saveGlobalConfig(current => ({
    ...current,
    companion: {
      ...stored,
      progress: getBuddyProgress(stored),
    },
    ...(unmute ? { companionMuted: false } : {}),
  }))
  return getCompanionFromStored({
    ...stored,
    progress: getBuddyProgress(stored),
  })
}

export function awardBuddyPromptTurn(
  context: Pick<LocalJSXCommandContext, 'setAppState'>,
  usage: {
    input_tokens?: number
    output_tokens?: number
    productiveTurn?: BuddyProductiveTurnSummary
  },
  now = Date.now(),
): Companion | undefined {
  const stored = getStoredCompanion()
  if (!stored) {
    return undefined
  }

  const currentProgress = getBuddyProgress(stored)
  const currentLevel = getBuddyLevelProgress(currentProgress.xpTotal).level
  const previousAchievementCount = getBuddyAchievementCount(currentProgress)
  const previousCombo = currentProgress.currentCombo
  const promptProgress = applyBuddyProgressEvent(currentProgress, {
    type: 'prompt_turn',
    at: now,
    xp: 10,
  })

  const productiveTurn = usage.productiveTurn
  const productiveProgress = productiveTurn && productiveTurn.toolSuccesses > 0
    ? applyBuddyProgressEvent(promptProgress, {
        type: 'productive_turn',
        at: now,
        toolSuccesses: productiveTurn.toolSuccesses,
        toolDurationMs: productiveTurn.toolDurationMs,
      })
    : promptProgress

  const tokenUsage = (usage.input_tokens ?? 0) + (usage.output_tokens ?? 0)
  const promptTurnBonusXp = getBuddyPromptTurnBonusXp(tokenUsage)
  const comboBonusXp = getBuddyComboBonusXp(productiveProgress.currentCombo)
  const finalProgress = applyBuddyProgressEvent(productiveProgress, {
    type: 'prompt_turn_bonus',
    xp: promptTurnBonusXp + comboBonusXp,
  })

  const nextStored = {
    ...stored,
    progress: finalProgress,
  }

  saveGlobalConfig(current => ({
    ...current,
    companion: nextStored,
  }))

  const awardedXp = 10 + promptTurnBonusXp + comboBonusXp
  const companion = getCompanionFromStored(nextStored)
  const nextLevel = getBuddyLevelProgress(finalProgress.xpTotal).level
  const nextAchievementCount = getBuddyAchievementCount(finalProgress)
  const unlockedAchievement =
    nextAchievementCount > previousAchievementCount
      ? getBuddyAchievements(finalProgress)[nextAchievementCount - 1]
      : undefined
  const comboImproved =
    productiveProgress.currentCombo >= 2 &&
    productiveProgress.currentCombo > previousCombo
  setBuddyXpGain(context, awardedXp)
  if (!getGlobalConfig().companionMuted) {
    const leveledUp = nextLevel > currentLevel
    const reactionText = leveledUp
      ? formatBuddyPhrase(
          pickBuddyPhrase(BUDDY_PROGRESS_PHRASES.levelUp, `${companion.name}:${nextLevel}`),
          { name: companion.name, level: nextLevel },
        )
      : unlockedAchievement
        ? formatBuddyPhrase(
            pickBuddyPhrase(BUDDY_PROGRESS_PHRASES.achievement, `${awardedXp}:${unlockedAchievement.id}`),
            { xp: awardedXp, achievement: unlockedAchievement.shortLabel },
          )
        : comboImproved
          ? formatBuddyPhrase(
              pickBuddyPhrase(BUDDY_PROGRESS_PHRASES.combo, `${awardedXp}:${productiveProgress.currentCombo}`),
              { xp: awardedXp, combo: productiveProgress.currentCombo },
            )
          : formatBuddyPhrase(
              pickBuddyPhrase(BUDDY_PROGRESS_PHRASES.xp, `${companion.name}:${awardedXp}`),
              { xp: awardedXp },
            )
    const animationKind = leveledUp
      ? 'levelUp'
      : unlockedAchievement
        ? 'achievement'
        : comboImproved
          ? 'combo'
          : 'speak'
    setCompanionReaction(
      context,
      reactionText,
      false,
      animationKind,
    )
  }

  return companion
}

export async function call(
  onDone: LocalJSXCommandOnDone,
  context: LocalJSXCommandContext,
  args?: string,
): Promise<null> {
  const trimmedArgs = args?.trim() ?? ''
  const normalized = trimmedArgs.toLowerCase()

  if (COMMON_HELP_ARGS.includes(normalized)) {
    showHelp(onDone)
    return null
  }

  if (COMMON_INFO_ARGS.includes(normalized) || normalized === 'status') {
    const companion = getCompanion()
    if (!companion) {
      showNoBuddy(onDone)
      return null
    }
    onDone(formatStatus(companion), { display: 'system' })
    return null
  }

  if (normalized === 'mode' || normalized.startsWith('mode ')) {
    const modeArg = trimmedArgs.slice('mode'.length).trim()
    if (!modeArg) {
      onDone(getBuddyModeStatus(getBuddyMode(getGlobalConfig())), {
        display: 'system',
      })
      return null
    }

    const mode = normalizeBuddyMode(modeArg)
    if (!mode) {
      onDone(
        `Usage: /buddy mode <minimal|balanced|expressive>\n\n${getBuddyModeHelp()}`,
        { display: 'system' },
      )
      return null
    }

    saveGlobalConfig(current => ({
      ...current,
      companionMode: mode,
    }))
    onDone(getBuddyModeStatus(mode), { display: 'system' })
    return null
  }

  if (normalized === 'export' || normalized.startsWith('export ')) {
    await exportBuddy(onDone, trimmedArgs.slice('export'.length).trim())
    return null
  }

  if (normalized === 'import' || normalized.startsWith('import ')) {
    await importBuddy(onDone, context, trimmedArgs.slice('import'.length).trim())
    return null
  }

  if (normalized === 'mute' || normalized === 'unmute') {
    const muted = normalized === 'mute'
    saveGlobalConfig(current => ({
      ...current,
      companionMuted: muted,
    }))
    if (muted) {
      setCompanionReaction(context, undefined)
    }
    onDone(`Buddy ${muted ? 'muted' : 'unmuted'}.`, { display: 'system' })
    return null
  }

  if (normalized === 'reset' || normalized === 'reroll') {
    const companion = saveBuddy(createStoredCompanion())
    setCompanionReaction(
      context,
      formatBuddyPhrase(
        pickBuddyPhrase(BUDDY_LIFECYCLE_PHRASES.arrived, `${companion.name}:${companion.species}`),
        { name: companion.name, species: companion.species },
      ),
      true,
    )
    onDone(
      `${companion.name} the ${companion.species} is now your buddy.`,
      { display: 'system' },
    )
    return null
  }

  if (normalized === 'rename' || normalized.startsWith('rename ')) {
    const stored = getStoredCompanion()
    if (!stored) {
      showNoBuddy(onDone)
      return null
    }
    const name = validateName(onDone, trimmedArgs.slice('rename'.length))
    if (!name) {
      return null
    }
    const companion = saveBuddy({ ...stored, name })
    setCompanionReaction(
      context,
      formatBuddyPhrase(
        pickBuddyPhrase(BUDDY_LIFECYCLE_PHRASES.renamed, companion.name),
        { name: companion.name },
      ),
    )
    onDone(`Buddy renamed to ${companion.name}.`, { display: 'system' })
    return null
  }

  if (normalized === 'edit' || normalized.startsWith('edit ')) {
    const stored = getStoredCompanion()
    if (!stored) {
      showNoBuddy(onDone)
      return null
    }
    const editArgs = trimmedArgs.slice('edit'.length).trim()
    if (!editArgs.toLowerCase().startsWith('personality')) {
      showUnknownSubcommand(onDone, trimmedArgs)
      return null
    }
    const personality = validatePersonality(
      onDone,
      editArgs.slice('personality'.length),
    )
    if (!personality) {
      return null
    }
    const companion = saveBuddy({ ...stored, personality })
    setCompanionReaction(
      context,
      formatBuddyPhrase(
        pickBuddyPhrase(BUDDY_LIFECYCLE_PHRASES.personalityEdited, companion.name),
        { name: companion.name },
      ),
    )
    onDone(`Updated ${companion.name}'s personality.`, { display: 'system' })
    return null
  }

  if (trimmedArgs !== '') {
    showUnknownSubcommand(onDone, trimmedArgs)
    return null
  }

  let companion = getCompanion()
  if (!companion) {
    companion = saveBuddy(createStoredCompanion(), true)
    setCompanionReaction(
      context,
      formatBuddyPhrase(
        pickBuddyPhrase(BUDDY_LIFECYCLE_PHRASES.hatched, `${companion.name}:${companion.species}`),
        { name: companion.name, species: companion.species },
      ),
      true,
    )
    onDone(
      `${companion.name} the ${companion.species} is now your buddy. Run /buddy again to pet them.`,
      { display: 'system' },
    )
    return null
  }

  const reaction = `${companion.name} ${pickBuddyPhrase(
    BUDDY_MANUAL_PET_PHRASES,
    `${Date.now()}:${companion.name}`,
  )}`
  setCompanionReaction(context, reaction, true)
  onDone(undefined, { display: 'skip' })
  return null
}
