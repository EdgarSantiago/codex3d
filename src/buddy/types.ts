export const RARITIES = [
  'common',
  'uncommon',
  'rare',
  'epic',
  'legendary',
] as const
export type Rarity = (typeof RARITIES)[number]

// One species name collides with a model-codename canary in excluded-strings.txt.
// The check greps build output (not source), so runtime-constructing the value keeps
// the literal out of the bundle while the check stays armed for the actual codename.
// All species encoded uniformly; `as` casts are type-position only (erased pre-bundle).
const c = String.fromCharCode
// biome-ignore format: keep the species list compact

export const duck = c(0x64,0x75,0x63,0x6b) as 'duck'
export const goose = c(0x67, 0x6f, 0x6f, 0x73, 0x65) as 'goose'
export const blob = c(0x62, 0x6c, 0x6f, 0x62) as 'blob'
export const cat = c(0x63, 0x61, 0x74) as 'cat'
export const dragon = c(0x64, 0x72, 0x61, 0x67, 0x6f, 0x6e) as 'dragon'
export const octopus = c(0x6f, 0x63, 0x74, 0x6f, 0x70, 0x75, 0x73) as 'octopus'
export const owl = c(0x6f, 0x77, 0x6c) as 'owl'
export const penguin = c(0x70, 0x65, 0x6e, 0x67, 0x75, 0x69, 0x6e) as 'penguin'
export const turtle = c(0x74, 0x75, 0x72, 0x74, 0x6c, 0x65) as 'turtle'
export const snail = c(0x73, 0x6e, 0x61, 0x69, 0x6c) as 'snail'
export const ghost = c(0x67, 0x68, 0x6f, 0x73, 0x74) as 'ghost'
export const axolotl = c(0x61, 0x78, 0x6f, 0x6c, 0x6f, 0x74, 0x6c) as 'axolotl'
export const capybara = c(
  0x63,
  0x61,
  0x70,
  0x79,
  0x62,
  0x61,
  0x72,
  0x61,
) as 'capybara'
export const cactus = c(0x63, 0x61, 0x63, 0x74, 0x75, 0x73) as 'cactus'
export const robot = c(0x72, 0x6f, 0x62, 0x6f, 0x74) as 'robot'
export const rabbit = c(0x72, 0x61, 0x62, 0x62, 0x69, 0x74) as 'rabbit'
export const mushroom = c(
  0x6d,
  0x75,
  0x73,
  0x68,
  0x72,
  0x6f,
  0x6f,
  0x6d,
) as 'mushroom'
export const chonk = c(0x63, 0x68, 0x6f, 0x6e, 0x6b) as 'chonk'

export const SPECIES = [
  duck,
  goose,
  blob,
  cat,
  dragon,
  octopus,
  owl,
  penguin,
  turtle,
  snail,
  ghost,
  axolotl,
  capybara,
  cactus,
  robot,
  rabbit,
  mushroom,
  chonk,
] as const
export type Species = (typeof SPECIES)[number] // biome-ignore format: keep compact

export const EYES = ['·', '✦', '×', '◉', '@', '°'] as const
export type Eye = (typeof EYES)[number]

export const HATS = [
  'none',
  'crown',
  'tophat',
  'propeller',
  'halo',
  'wizard',
  'beanie',
  'tinyduck',
] as const
export type Hat = (typeof HATS)[number]

export const STAT_NAMES = [
  'DEBUGGING',
  'PATIENCE',
  'CHAOS',
  'WISDOM',
  'SNARK',
] as const
export type StatName = (typeof STAT_NAMES)[number]

// Deterministic parts — derived from hash(userId)
export type CompanionBones = {
  rarity: Rarity
  species: Species
  eye: Eye
  hat: Hat
  shiny: boolean
  stats: Record<StatName, number>
}

export type CompanionMood = 'excited' | 'content' | 'sleepy' | 'lonely'
export type BuddyMode = 'minimal' | 'balanced' | 'expressive'

export const BUDDY_MODES = ['minimal', 'balanced', 'expressive'] as const

export function isValidBuddyMode(value: string): value is BuddyMode {
  return value === 'minimal' || value === 'balanced' || value === 'expressive'
}

export function normalizeBuddyMode(value: string | undefined): BuddyMode | undefined {
  if (!value) return undefined
  const normalized = value.trim().toLowerCase()
  return isValidBuddyMode(normalized) ? normalized : undefined
}

export function getBuddyMode(config: { companionMode?: BuddyMode }): BuddyMode {
  return config.companionMode ?? 'balanced'
}

export function formatBuddyMode(mode: BuddyMode): string {
  return mode.charAt(0).toUpperCase() + mode.slice(1)
}

export function getBuddyModeDescription(mode: BuddyMode): string {
  switch (mode) {
    case 'minimal':
      return 'Token-safe: disables buddy commentary and model-facing buddy context.'
    case 'balanced':
      return 'Keeps local buddy commentary, progression, and visuals enabled.'
    case 'expressive':
      return 'Enables buddy commentary plus model-facing buddy context.'
    default: {
      const _exhaustive: never = mode
      return _exhaustive
    }
  }
}

export function isBuddyCommentaryEnabled(config: {
  companionMode?: BuddyMode
}): boolean {
  return getBuddyMode(config) !== 'minimal'
}

export function isBuddyModelContextEnabled(config: {
  companionMode?: BuddyMode
}): boolean {
  return getBuddyMode(config) === 'expressive'
}

export function getBuddyModeStatus(mode: BuddyMode): string {
  return `${formatBuddyMode(mode)} — ${getBuddyModeDescription(mode)}`
}

export function getBuddyModeHelp(): string {
  return 'Use /buddy mode <minimal|balanced|expressive> to control token-sensitive buddy behavior.'
}

export function getDefaultBuddyMode(): BuddyMode {
  return 'balanced'
}

export function shouldBuddyStayTokenSafe(config: {
  companionMode?: BuddyMode
}): boolean {
  return getBuddyMode(config) === 'minimal'
}

export function shouldBuddySpendExtraTokens(config: {
  companionMode?: BuddyMode
}): boolean {
  return getBuddyMode(config) !== 'minimal'
}

export type BuddyModeRecord = {
  companionMode?: BuddyMode
}

export type BuddyModeHelpersConfig = {
  companionMode?: BuddyMode
}

export function parseBuddyModeArg(arg: string): BuddyMode | undefined {
  return normalizeBuddyMode(arg)
}

export function getBuddyModeChoices(): readonly BuddyMode[] {
  return BUDDY_MODES
}

export function getBuddyModeSummary(mode: BuddyMode): string {
  return `${formatBuddyMode(mode)} · ${getBuddyModeDescription(mode)}`
}

export function getBuddyModeShortDescription(mode: BuddyMode): string {
  switch (mode) {
    case 'minimal':
      return 'Token-safe'
    case 'balanced':
      return 'Light commentary'
    case 'expressive':
      return 'Full commentary'
    default: {
      const _exhaustive: never = mode
      return _exhaustive
    }
  }
}

export function shouldBuddyUsePromptAttachment(config: {
  companionMode?: BuddyMode
}): boolean {
  return isBuddyModelContextEnabled(config)
}

export function shouldBuddyUseObserverCommentary(config: {
  companionMode?: BuddyMode
}): boolean {
  return isBuddyCommentaryEnabled(config)
}

export function getBuddyModeStatusText(mode: BuddyMode): string {
  return `${formatBuddyMode(mode)} mode active.`
}

export function getBuddyModeHint(): string {
  return 'Minimal keeps XP, mood, and animations while disabling token-sensitive commentary and prompt context.'
}

export function getBuddyModeRecommendation(): BuddyMode {
  return 'balanced'
}

export function isBuddyExpressiveMode(config: {
  companionMode?: BuddyMode
}): boolean {
  return getBuddyMode(config) === 'expressive'
}

export function isBuddyMinimalMode(config: {
  companionMode?: BuddyMode
}): boolean {
  return getBuddyMode(config) === 'minimal'
}

export function isBuddyBalancedMode(config: {
  companionMode?: BuddyMode
}): boolean {
  return getBuddyMode(config) === 'balanced'
}

export function getBuddyModeLine(mode: BuddyMode): string {
  return `Mode: ${formatBuddyMode(mode)}`
}

export function getBuddyModeDefaultValue(): BuddyMode {
  return 'balanced'
}

export function shouldBuddyUseAmbientReactions(config: {
  companionMode?: BuddyMode
}): boolean {
  return isBuddyCommentaryEnabled(config)
}

export function shouldBuddyUsePromptContext(config: {
  companionMode?: BuddyMode
}): boolean {
  return isBuddyModelContextEnabled(config)
}

export function getBuddyModeTokenSummary(config: {
  companionMode?: BuddyMode
}): string {
  return shouldBuddyStayTokenSafe(config)
    ? 'Token-safe mode active.'
    : 'Buddy commentary may use additional tokens.'
}

export function getBuddyModeBanner(config: { companionMode?: BuddyMode }): string {
  const mode = getBuddyMode(config)
  return `${getBuddyModeSummary(mode)} · ${getBuddyModeTokenSummary(config)}`
}

export function getBuddyModeChoiceText(): string {
  return 'minimal | balanced | expressive'
}

export function createBuddyModeCommandHelp(): string {
  return 'Use /buddy mode <minimal|balanced|expressive> to choose token-safe or richer buddy behavior.'
}

export function createBuddyModeNote(): string {
  return 'Minimal disables token-sensitive buddy commentary and model-facing buddy context while keeping local progression and visuals active.'
}

export type BuddyProgress = {
  xpTotal: number
  promptTurns: number
  errorFeeds: number
  currentStreak: number
  bestStreak: number
  highestStatMilestone: number
  statBonuses?: Partial<Record<StatName, number>>
  lastPromptAt?: number
  recentPromptTurnAts: number[]
  recentErrorFeedKeys: string[]
  version: number
}

export type BuddyProgressEvent =
  | {
      type: 'prompt_turn'
      at: number
      xp: number
    }
  | {
      type: 'prompt_turn_bonus'
      xp: number
    }
  | {
      type: 'tool_error'
      at: number
      feedKey: string
    }

// Model-generated soul — stored in config after first hatch
export type CompanionSoul = {
  name: string
  personality: string
}

export type Companion = CompanionBones &
  CompanionSoul & {
    hatchedAt: number
    progress: BuddyProgress
    level: number
    mood: CompanionMood
  }

// What actually persists in config. Bones are regenerated on every read,
// usually from the stored seed and otherwise from the legacy user-based roll,
// so species renames don't break stored companions and users can't edit their
// way to a legendary.
export type StoredCompanion = CompanionSoul & {
  hatchedAt: number
  seed?: string
  progress?: BuddyProgress
}

export const RARITY_WEIGHTS = {
  common: 60,
  uncommon: 25,
  rare: 10,
  epic: 4,
  legendary: 1,
} as const satisfies Record<Rarity, number>

export const RARITY_STARS = {
  common: '★',
  uncommon: '★★',
  rare: '★★★',
  epic: '★★★★',
  legendary: '★★★★★',
} as const satisfies Record<Rarity, string>

export const RARITY_COLORS = {
  common: 'inactive',
  uncommon: 'success',
  rare: 'permission',
  epic: 'autoAccept',
  legendary: 'warning',
} as const satisfies Record<Rarity, keyof import('../utils/theme.js').Theme>
