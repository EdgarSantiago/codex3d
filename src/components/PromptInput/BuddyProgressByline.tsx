import * as React from 'react'
import { getCompanion } from '../../buddy/companion.js'
import { isBuddyEnabled } from '../../buddy/feature.js'
import {
  getBuddyLevelProgress,
  getBuddyLevelProgressBar,
} from '../../buddy/progression.js'
import { Text } from '../../ink.js'
import { useAppState } from '../../state/AppState.js'
import { getGlobalConfig } from '../../utils/config.js'

export function getBuddyProgressBylineText(width = 6): string | null {
  if (!isBuddyEnabled()) {
    return null
  }

  if (getGlobalConfig().companionMuted) {
    return null
  }

  const companion = getCompanion()
  if (!companion) {
    return null
  }

  const progress = getBuddyLevelProgress(companion.progress.xpTotal)
  return `Buddy L${progress.level} · ${getBuddyLevelProgressBar(companion.progress.xpTotal, width)} ${progress.xpIntoLevel}/${progress.xpNeededThisLevel} XP`
}

export function BuddyProgressByline({
  width = 6,
}: {
  width?: number
}): React.ReactNode {
  useAppState(s => s.companionAnimation?.at)

  const text = getBuddyProgressBylineText(width)
  if (!text) {
    return null
  }

  return <Text dimColor>{text}</Text>
}
