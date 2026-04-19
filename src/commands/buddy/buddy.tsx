import { randomUUID } from 'crypto'
import type { LocalJSXCommandContext, LocalJSXCommandOnDone } from '../../types/command.js'
import { getGlobalConfig, saveGlobalConfig } from '../../utils/config.js'
import {
  companionUserId,
  getCompanion,
  getCompanionFromStored,
} from '../../buddy/companion.js'
import type { BuddyMode, Companion, StoredCompanion } from '../../buddy/types.js'
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
  getBuddyLevelProgress,
  getBuddyLevelProgressBar,
  getBuddyMoodDisplay,
  getBuddyProgress,
} from '../../buddy/progression.js'
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

const PET_REACTIONS = [
  'leans into the headpat',
  'does a proud little bounce',
  'emits a content beep',
  'looks delighted',
  'wiggles happily',
] as const

const MAX_NAME_LENGTH = 32
const MAX_PERSONALITY_LENGTH = 160

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
  kind: 'idle' | 'pet' | 'speak' | 'errorFeed' = pet ? 'pet' : reaction ? 'speak' : 'idle',
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
  return `${name} munches the ${toolName} error.`
}

export function awardBuddyPromptTurn(now = Date.now()): Companion | undefined {
  const stored = getStoredCompanion()
  if (!stored) {
    return undefined
  }

  const nextProgress = applyBuddyProgressEvent(getBuddyProgress(stored), {
    type: 'prompt_turn',
    at: now,
  })

  const nextStored = {
    ...stored,
    progress: nextProgress,
  }

  saveGlobalConfig(current => ({
    ...current,
    companion: nextStored,
  }))

  return getCompanionFromStored(nextStored)
}

function renderHelp(): string {
  return `Usage: /buddy [status|mode <minimal|balanced|expressive>|rename <name>|edit personality <text>|reset|reroll|mute|unmute|help]

Manage your one active buddy.

${getBuddyModeHelp()}

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

function formatStatus(companion: Companion): string {
  const mode = getBuddyMode(getGlobalConfig())
  const progress = getBuddyLevelProgress(companion.progress.xpTotal)
  const stats = Object.entries(companion.stats)
    .map(([name, value]) => `${name} ${value}`)
    .join(' · ')

  const lines = [
    `${companion.name} · ${RARITY_STARS[companion.rarity]} ${titleCase(companion.rarity)} ${titleCase(companion.species)}`,
    companion.personality,
    '─'.repeat(44),
    `Level ${companion.level} · ${companion.progress.xpTotal} XP`,
    `Mood ${getBuddyMoodDisplay(companion.mood)} · Mode ${formatBuddyMode(mode)}`,
    `${getBuddyLevelProgressBar(companion.progress.xpTotal)} ${progress.xpIntoLevel}/${progress.xpNeededThisLevel} XP · ${progress.xpRemaining} to next`,
    `Prompt turns ${companion.progress.promptTurns}`,
    '─'.repeat(44),
    stats,
  ]

  const width = lines.reduce((max, line) => Math.max(max, line.length), 0)
  const top = `┌${'─'.repeat(width + 2)}┐`
  const middle = lines.map(line => `│ ${line.padEnd(width)} │`)
  const bottom = `└${'─'.repeat(width + 2)}┘`

  return [top, ...middle, bottom].join('\n')
}

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

export function awardBuddyPromptTurn(now = Date.now()): Companion | undefined {
  const stored = getStoredCompanion()
  if (!stored) {
    return undefined
  }

  const nextProgress = applyBuddyProgressEvent(getBuddyProgress(stored), {
    type: 'prompt_turn',
    at: now,
  })

  const nextStored = {
    ...stored,
    progress: nextProgress,
  }

  saveGlobalConfig(current => ({
    ...current,
    companion: nextStored,
  }))

  return getCompanionFromStored(nextStored)
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
      `${companion.name} the ${companion.species} has arrived.`,
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
    setCompanionReaction(context, `${companion.name} looks pleased with the new name.`)
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
    setCompanionReaction(context, `${companion.name} seems extra self-aware now.`)
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
      `${companion.name} the ${companion.species} has hatched.`,
      true,
    )
    onDone(
      `${companion.name} the ${companion.species} is now your buddy. Run /buddy again to pet them.`,
      { display: 'system' },
    )
    return null
  }

  const reaction = `${companion.name} ${pickDeterministic(
    PET_REACTIONS,
    `${Date.now()}:${companion.name}`,
  )}`
  setCompanionReaction(context, reaction, true)
  onDone(undefined, { display: 'skip' })
  return null
}
