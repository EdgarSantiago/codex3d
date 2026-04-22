import * as React from 'react'
import { getCompanion } from '../../buddy/companion.js'
import {
  formatBuddyWorkDuration,
  getBuddyAchievementCount,
  getBuddyAchievements,
  getBuddyMoodBar,
} from '../../buddy/progression.js'
import {
  formatBuddyMode,
  getBuddyMode,
  getBuddyModeDescription,
  RARITY_COLORS,
  RARITY_STARS,
  type BuddyMode,
} from '../../buddy/types.js'
import { Box, Text } from '../../ink.js'
import type { Theme } from '../../utils/theme.js'
import { getGlobalConfig } from '../../utils/config.js'
import {
  Select,
  type OptionWithDescription,
} from '../CustomSelect/select.js'
import { PermissionDialog } from '../permissions/PermissionDialog.js'

type BuddyMenuDialogProps = {
  onDone: () => void
  onSubmitCommand: (command: string) => void
}

type BuddyMenuView = 'actions' | 'mode' | 'rename' | 'personality'

type BuddyMenuValue =
  | 'pet'
  | 'status'
  | 'resume'
  | 'mode'
  | 'rename'
  | 'personality'
  | 'reroll'
  | 'mute'
  | 'back'
  | 'submit-rename'
  | 'submit-personality'
  | BuddyMode

function titleCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

function rarityColor(rarity: keyof typeof RARITY_COLORS): keyof Theme {
  return RARITY_COLORS[rarity]
}

function SummaryRow({
  label,
  value,
}: {
  label: string
  value: React.ReactNode
}): React.ReactNode {
  return (
    <Box>
      <Text dimColor>{label}</Text>
      <Text> {value}</Text>
    </Box>
  )
}

export function BuddyMenuDialog({
  onDone,
  onSubmitCommand,
}: BuddyMenuDialogProps): React.ReactNode {
  const companion = getCompanion()
  const config = getGlobalConfig()
  const currentMode = getBuddyMode(config)
  const [view, setView] = React.useState<BuddyMenuView>('actions')
  const [renameValue, setRenameValue] = React.useState('')
  const [personalityValue, setPersonalityValue] = React.useState('')

  if (!companion || config.companionMuted) {
    return null
  }

  const summaryHeader = (
    <Box flexDirection="column" marginBottom={1} paddingX={1}>
      <Text dimColor>Companion dossier</Text>
      <Text bold color={rarityColor(companion.rarity)}>
        {companion.name} the {titleCase(companion.rarity)} {titleCase(companion.species)}{' '}
        <Text color={rarityColor(companion.rarity)}>{RARITY_STARS[companion.rarity]}</Text>
      </Text>
      <Text dimColor italic wrap="wrap">
        {companion.personality}
      </Text>
      <Box marginTop={1}>
        <Text>
          Level {companion.level} · {companion.progress.xpTotal} XP · Mood:{' '}
          <Text color={rarityColor(companion.rarity)}>{titleCase(companion.mood)}</Text>
        </Text>
      </Box>
      <Text dimColor>Emotion {getBuddyMoodBar(companion.progress)}</Text>
    </Box>
  )

  const earnedAchievements = getBuddyAchievements(companion.progress)
  const summaryPanel = (
    <Box flexDirection="column" marginBottom={1}>
      {summaryHeader}
      <Box flexDirection="column" paddingX={1}>
        <Text dimColor>Character sheet</Text>
        <SummaryRow
          label="Species:"
          value={<Text color={rarityColor(companion.rarity)}>{titleCase(companion.species)}</Text>}
        />
        <SummaryRow label="Prompt turns:" value={companion.progress.promptTurns} />
        <SummaryRow label="Productive turns:" value={companion.progress.productiveTurns} />
        <SummaryRow label="Work time:" value={formatBuddyWorkDuration(companion.progress.workDurationMs)} />
        <SummaryRow label="Combo:" value={`x${companion.progress.currentCombo} (best x${companion.progress.bestCombo})`} />
        <SummaryRow label="Streak:" value={`${companion.progress.currentStreak}d (best ${companion.progress.bestStreak}d)`} />
        <SummaryRow label="Achievements:" value={getBuddyAchievementCount(companion.progress)} />
        <SummaryRow
          label="Badges:"
          value={earnedAchievements.length > 0 ? earnedAchievements.slice(0, 3).map(a => a.shortLabel).join(', ') : 'None yet'}
        />
        <SummaryRow label="Mode:" value={formatBuddyMode(currentMode)} />
      </Box>
    </Box>
  )

  const actionHeading = view === 'actions' ? 'Quest board' : 'Training grounds'
  const actionSubheading =
    view === 'actions'
      ? `${companion.name} is ready. Pick the next move.`
      : 'Choose the next command for your companion.'

  function submit(command: string): void {
    onDone()
    onSubmitCommand(command)
  }

  function handleActions(value: BuddyMenuValue): void {
    switch (value) {
      case 'pet':
        submit('/buddy')
        return
      case 'status':
        submit('/buddy status')
        return
      case 'resume':
        submit('/resume')
        return
      case 'mode':
        setView('mode')
        return
      case 'rename':
        setView('rename')
        return
      case 'personality':
        setView('personality')
        return
      case 'reroll':
        submit('/buddy reroll')
        return
      case 'mute':
        submit('/buddy mute')
        return
      default:
        return
    }
  }

  function handleMode(value: BuddyMenuValue): void {
    if (value === 'back') {
      setView('actions')
      return
    }

    submit(`/buddy mode ${value}`)
  }

  function handleRename(value: BuddyMenuValue): void {
    if (value === 'back') {
      setView('actions')
      return
    }

    if (value === 'submit-rename') {
      submit(`/buddy rename ${renameValue}`)
    }
  }

  function handlePersonality(value: BuddyMenuValue): void {
    if (value === 'back') {
      setView('actions')
      return
    }

    if (value === 'submit-personality') {
      submit(`/buddy edit personality ${personalityValue}`)
    }
  }

  let title = 'Buddy'
  let subtitle: React.ReactNode = `${companion.name} companion panel`
  let options: OptionWithDescription<BuddyMenuValue>[]
  let onChange: (value: BuddyMenuValue) => void
  let onCancel = onDone
  let summary = summaryPanel

  switch (view) {
    case 'mode':
      title = 'Buddy mode'
      subtitle = 'Choose how chatty and token-heavy your buddy should be.'
      options = ([
        'minimal',
        'balanced',
        'expressive',
      ] as const).map(mode => ({
        label: formatBuddyMode(mode),
        value: mode,
        description: getBuddyModeDescription(mode),
      }))
      options.push({
        label: 'Back',
        value: 'back',
        description: 'Return to the main buddy actions.',
      })
      onChange = handleMode
      onCancel = () => setView('actions')
      break
    case 'rename':
      title = 'Rename buddy'
      subtitle = 'Give your companion a new call sign.'
      summary = (
        <Box flexDirection="column" marginBottom={1} paddingX={1}>
          {summaryHeader}
          <SummaryRow label="Current name:" value={companion.name} />
        </Box>
      )
      options = [
        {
          label: 'New name',
          value: 'submit-rename',
          type: 'input',
          placeholder: 'Type a new name',
          initialValue: '',
          onChange: setRenameValue,
          showLabelWithValue: true,
          labelValueSeparator: ': ',
        },
        {
          label: 'Back',
          value: 'back',
          description: 'Return to the main buddy actions.',
        },
      ]
      onChange = handleRename
      onCancel = () => setView('actions')
      break
    case 'personality':
      title = 'Edit personality'
      subtitle = 'Tune how your buddy presents itself in the terminal.'
      summary = (
        <Box flexDirection="column" marginBottom={1} paddingX={1}>
          {summaryHeader}
          <SummaryRow label="Current personality:" value={<Text wrap="wrap">{companion.personality}</Text>} />
        </Box>
      )
      options = [
        {
          label: 'New personality',
          value: 'submit-personality',
          type: 'input',
          placeholder: 'Type a new personality',
          initialValue: '',
          onChange: setPersonalityValue,
          showLabelWithValue: true,
          labelValueSeparator: ': ',
        },
        {
          label: 'Back',
          value: 'back',
          description: 'Return to the main buddy actions.',
        },
      ]
      onChange = handlePersonality
      onCancel = () => setView('actions')
      break
    case 'actions':
    default:
      options = [
        {
          label: 'Pet',
          value: 'pet',
          description: 'Give your companion a quick morale boost without leaving the prompt.',
        },
        {
          label: 'Status',
          value: 'status',
          description: 'Show the full adventure log and companion stats in the transcript.',
        },
        {
          label: 'Resume',
          value: 'resume',
          description: 'Open the recent sessions board and jump back into an earlier quest.',
        },
        {
          label: 'Mode',
          value: 'mode',
          description: `${formatBuddyMode(currentMode)} stance is active right now.`,
        },
        {
          label: 'Rename',
          value: 'rename',
          description: 'Give your companion a new legendary name.',
        },
        {
          label: 'Edit personality',
          value: 'personality',
          description: 'Rewrite the flavor text your buddy uses in the terminal.',
        },
        {
          label: 'Reroll',
          value: 'reroll',
          description: 'Hatch a fresh buddy with a new look and origin story.',
        },
        {
          label: 'Mute',
          value: 'mute',
          description: 'Send your buddy offstage until you call them back.',
        },
      ]
      onChange = handleActions
      break
  }

  return (
    <PermissionDialog
      title={title}
      subtitle={subtitle}
      innerPaddingX={0}
      titleRight={
        <Text color={rarityColor(companion.rarity)}>
          {formatBuddyMode(currentMode)} · {RARITY_STARS[companion.rarity]}
        </Text>
      }
    >
      <Box flexDirection="column" paddingY={1}>
        {summary}
        <Box marginTop={1} paddingX={2} flexDirection="column">
          <Text bold>{actionHeading}</Text>
          <Text dimColor>{actionSubheading}</Text>
        </Box>
        <Box paddingX={2} paddingBottom={1}>
          <Select
            options={options}
            onChange={onChange}
            onCancel={onCancel}
            layout="compact-vertical"
          />
        </Box>
      </Box>
    </PermissionDialog>
  )
}
