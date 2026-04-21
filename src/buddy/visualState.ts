import type { CompanionMood } from './types.js'

export type CompanionAnimationKind =
  | 'idle'
  | 'pet'
  | 'speak'
  | 'errorFeed'
  | 'combo'
  | 'achievement'
  | 'levelUp'

export type CompanionAnimationState = {
  kind: CompanionAnimationKind
  at: number
}

export type CompanionVisualDecision = {
  activeKind: CompanionAnimationKind
  spriteFrame: number
  blink: boolean
}

const IDLE_SEQUENCE = [0, 0, 0, 0, 1, 0, 0, 0, -1, 0, 0, 2, 0, 0, 0] as const
const SLEEPY_SEQUENCE = [0, 0, 0, 0, 0, -1, 0, 0] as const
const LONELY_SEQUENCE = [0, 0, -1, 0, 0, 0, -1, 0] as const
const ERROR_FEED_SEQUENCE = [2, 1, 2, 0, 2, 1] as const
const COMBO_SEQUENCE = [0, 1, 2, 1, 2, 1] as const
const ACHIEVEMENT_SEQUENCE = [2, 1, 2, 0, 2, 1, 2, 0] as const
const LEVEL_UP_SEQUENCE = [2, 0, 2, 1, 2, 0, 1, 2] as const
const PET_WINDOW_MS = 2500
const ERROR_FEED_WINDOW_MS = 3000
const COMBO_WINDOW_MS = 2500
const ACHIEVEMENT_WINDOW_MS = 3200
const LEVEL_UP_WINDOW_MS = 3400
const SPEAK_WINDOW_MS = 10000

export function getActiveCompanionAnimationKind(params: {
  mood: CompanionMood
  now: number
  reaction?: string
  petAt?: number
  animation?: CompanionAnimationState
}): CompanionAnimationKind {
  const { now, reaction, petAt, animation } = params

  if (
    animation?.kind === 'errorFeed' &&
    now - animation.at < ERROR_FEED_WINDOW_MS
  ) {
    return 'errorFeed'
  }

  if (
    animation?.kind === 'levelUp' &&
    now - animation.at < LEVEL_UP_WINDOW_MS
  ) {
    return 'levelUp'
  }

  if (
    animation?.kind === 'achievement' &&
    now - animation.at < ACHIEVEMENT_WINDOW_MS
  ) {
    return 'achievement'
  }

  if (
    animation?.kind === 'combo' &&
    now - animation.at < COMBO_WINDOW_MS
  ) {
    return 'combo'
  }

  if (petAt && now - petAt < PET_WINDOW_MS) {
    return 'pet'
  }

  if (reaction && animation?.kind === 'speak' && now - animation.at < SPEAK_WINDOW_MS) {
    return 'speak'
  }

  if (reaction) {
    return 'speak'
  }

  return 'idle'
}

export function decideCompanionVisualState(params: {
  mood: CompanionMood
  now: number
  tick: number
  frameCount: number
  reaction?: string
  petAt?: number
  animation?: CompanionAnimationState
}): CompanionVisualDecision {
  const activeKind = getActiveCompanionAnimationKind(params)

  if (activeKind === 'errorFeed') {
    return {
      activeKind,
      spriteFrame: ERROR_FEED_SEQUENCE[params.tick % ERROR_FEED_SEQUENCE.length]! % params.frameCount,
      blink: false,
    }
  }

  if (activeKind === 'levelUp') {
    return {
      activeKind,
      spriteFrame:
        LEVEL_UP_SEQUENCE[params.tick % LEVEL_UP_SEQUENCE.length]! %
        params.frameCount,
      blink: false,
    }
  }

  if (activeKind === 'achievement') {
    return {
      activeKind,
      spriteFrame:
        ACHIEVEMENT_SEQUENCE[params.tick % ACHIEVEMENT_SEQUENCE.length]! %
        params.frameCount,
      blink: false,
    }
  }

  if (activeKind === 'combo') {
    return {
      activeKind,
      spriteFrame: COMBO_SEQUENCE[params.tick % COMBO_SEQUENCE.length]! % params.frameCount,
      blink: false,
    }
  }

  if (activeKind === 'pet' || activeKind === 'speak' || params.mood === 'excited') {
    return {
      activeKind,
      spriteFrame: params.tick % params.frameCount,
      blink: false,
    }
  }

  const sequence =
    params.mood === 'sleepy'
      ? SLEEPY_SEQUENCE
      : params.mood === 'lonely'
        ? LONELY_SEQUENCE
        : IDLE_SEQUENCE
  const step = sequence[params.tick % sequence.length]!

  return {
    activeKind,
    spriteFrame: step === -1 ? 0 : step % params.frameCount,
    blink: step === -1,
  }
}
