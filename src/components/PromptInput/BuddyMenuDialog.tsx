import * as React from 'react'
import { getCompanion } from '../../buddy/companion.js'
import {
  formatBuddyMode,
  getBuddyMode,
  getBuddyModeDescription,
  type BuddyMode,
} from '../../buddy/types.js'
import { Box, Text } from '../../ink.js'
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
  | 'mode'
  | 'rename'
  | 'personality'
  | 'reroll'
  | 'mute'
  | 'back'
  | 'submit-rename'
  | 'submit-personality'
  | BuddyMode

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
  let subtitle: React.ReactNode = `${companion.name} the ${companion.species}`
  let options: OptionWithDescription<BuddyMenuValue>[]
  let onChange: (value: BuddyMenuValue) => void
  let onCancel = onDone

  switch (view) {
    case 'mode':
      title = 'Buddy mode'
      subtitle = `${formatBuddyMode(currentMode)} is active.`
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
      })
      onChange = handleMode
      onCancel = () => setView('actions')
      break
    case 'rename':
      title = 'Rename buddy'
      subtitle = <Text dimColor>Current name: {companion.name}</Text>
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
        },
      ]
      onChange = handleRename
      onCancel = () => setView('actions')
      break
    case 'personality':
      title = 'Edit personality'
      subtitle = <Text dimColor>{companion.personality}</Text>
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
          description: 'Give your buddy a quick reaction.',
        },
        {
          label: 'Status',
          value: 'status',
          description: 'Show mood, level, XP, and mode.',
        },
        {
          label: 'Mode',
          value: 'mode',
          description: `${formatBuddyMode(currentMode)} is active.`,
        },
        {
          label: 'Rename',
          value: 'rename',
          description: 'Choose a new buddy name.',
        },
        {
          label: 'Edit personality',
          value: 'personality',
          description: 'Rewrite how your buddy describes itself.',
        },
        {
          label: 'Reroll',
          value: 'reroll',
          description: 'Hatch a brand new buddy.',
        },
        {
          label: 'Mute',
          value: 'mute',
          description: 'Hide buddy reactions until /buddy unmute.',
        },
      ]
      onChange = handleActions
      break
  }

  return (
    <PermissionDialog
      title={title}
      subtitle={subtitle}
      titleRight={<Text dimColor>Mode: {formatBuddyMode(currentMode)}</Text>}
    >
      <Box flexDirection="column" paddingX={2} paddingY={1}>
        <Select
          options={options}
          onChange={onChange}
          onCancel={onCancel}
          layout="compact-vertical"
        />
      </Box>
    </PermissionDialog>
  )
}
