import { afterEach, expect, mock, test } from 'bun:test'
import React from 'react'

let renderToStringFn: typeof import('../../utils/staticRender.tsx').renderToString
let latestSelectProps:
  | {
      options: Array<{ label: React.ReactNode; value: string; description?: string }>
      onChange: (value: string) => void
    }
  | undefined

function installBundleMock() {
  const bundleMock = {
    feature: () => false,
  }
  mock.module('bun:bundle', () => bundleMock)
  mock.module('bundle', () => bundleMock)
}

async function loadStaticRenderer() {
  installBundleMock()
  const { renderToString } = await import('../../utils/staticRender.tsx')
  renderToStringFn = renderToString
}

async function importFreshBuddyMenuDialog() {
  installBundleMock()
  return import(`./BuddyMenuDialog.tsx?ts=${Date.now()}-${Math.random()}`)
}

async function renderNode(node: React.ReactNode, columns = 100): Promise<string> {
  if (!renderToStringFn) {
    await loadStaticRenderer()
  }
  return renderToStringFn(node, columns)
}

type MockBuddyConfig = {
  companionMuted?: boolean
  companionMode?: 'minimal' | 'balanced' | 'expressive'
}

const mockConfig: MockBuddyConfig = {
  companionMode: 'balanced',
  companionMuted: false,
}

const mockCompanion = {
  name: 'Patch',
  species: 'owl',
  rarity: 'rare' as const,
  eye: '·' as const,
  hat: 'none' as const,
  shiny: false,
  personality: 'Calm under pressure and fond of clean diffs.',
  stats: {
    DEBUGGING: 50,
    PATIENCE: 40,
    CHAOS: 30,
    WISDOM: 20,
    SNARK: 10,
  },
  hatchedAt: 1,
  progress: {
    xpTotal: 10,
    promptTurns: 2,
    productiveTurns: 3,
    workDurationMs: 35 * 60 * 1000,
    errorFeeds: 0,
    currentStreak: 4,
    bestStreak: 4,
    currentCombo: 2,
    bestCombo: 3,
    highestStatMilestone: 0,
    statBonuses: undefined,
    lastPromptAt: undefined,
    lastWorkAt: 1,
    lastComboAt: 1,
    lastStreakDay: 1,
    recentPromptTurnAts: [],
    recentWorkAts: [1, 2, 3],
    recentErrorFeedKeys: [],
    version: 4,
  },
  level: 1,
  mood: 'content' as const,
}

function installBuddyMenuMocks() {
  latestSelectProps = undefined

  mock.module('../../buddy/companion.js', () => ({
    getCompanion: () => mockCompanion,
  }))
  mock.module('../../utils/config.js', () => ({
    getGlobalConfig: () => mockConfig,
    saveGlobalConfig: () => {},
    checkHasTrustDialogAccepted: () => true,
  }))
  mock.module('../permissions/PermissionDialog.js', () => ({
    PermissionDialog: ({ children, title, titleRight }: { children: React.ReactNode; title: string; titleRight?: React.ReactNode }) => (
      <>
        <div>{title}</div>
        <div>{titleRight}</div>
        {children}
      </>
    ),
  }))
  mock.module('../CustomSelect/select.js', () => ({
    Select: ({ options, onChange }: { options: Array<{ label: React.ReactNode; value: string; description?: string }>; onChange: (value: string) => void }) => {
      latestSelectProps = { options, onChange }
      return (
        <>
          {options.map((option, index) => (
            <div key={index}>
              <div>{option.label}</div>
              {option.description ? <div>{option.description}</div> : null}
            </div>
          ))}
        </>
      )
    },
  }))
}

function currentOptionLabels(): string[] {
  return latestSelectProps?.options.map(option => String(option.label)) ?? []
}

function currentOptionDescriptions(): string[] {
  return latestSelectProps?.options.map(option => option.description ?? '') ?? []
}

afterEach(() => {
  mock.restore()
  mockConfig.companionMode = 'balanced'
  mockConfig.companionMuted = false
  latestSelectProps = undefined
})

test('renders buddy actions menu with resume option after status', async () => {
  installBuddyMenuMocks()
  const { BuddyMenuDialog } = await importFreshBuddyMenuDialog()

  const output = await renderNode(
    <BuddyMenuDialog onDone={() => {}} onSubmitCommand={() => {}} />,
    100,
  )

  expect(output).toContain('Companion dossier')
  expect(output).toContain('Patch the Rare Owl ★★★')
  expect(output).toContain('Character sheet')
  expect(output).toContain('Mode: Balanced')
  expect(output).toContain('Species: Owl')
  expect(output).toContain('Prompt turns: 2')
  expect(output).toContain('Productive turns: 3')
  expect(output).toContain('Work time: 35m')
  expect(output).toContain('Combo: x2 (best x3)')
  expect(output).toContain('Streak: 4d (best 4d)')
  expect(output).toContain('Achievements: 4')
  expect(output).toContain('Badges: First work, x2 combo, 3d streak')
  expect(output).toContain('Quest board')
  expect(output).toContain('Patch is ready. Pick the next move.')

  expect(currentOptionLabels()).toEqual([
    'Pet',
    'Status',
    'Resume',
    'Mode',
    'Rename',
    'Edit personality',
    'Reroll',
    'Mute',
  ])
  expect(currentOptionLabels().indexOf('Status')).toBeLessThan(currentOptionLabels().indexOf('Resume'))
  expect(currentOptionLabels().indexOf('Resume')).toBeLessThan(currentOptionLabels().indexOf('Mode'))
  expect(currentOptionDescriptions()).toContain('Open the recent sessions board and jump back into an earlier quest.')
})

test('submits /resume from the buddy menu', async () => {
  installBuddyMenuMocks()
  const onDone = mock()
  const onSubmitCommand = mock()
  const { BuddyMenuDialog } = await importFreshBuddyMenuDialog()

  await renderNode(
    <BuddyMenuDialog onDone={onDone} onSubmitCommand={onSubmitCommand} />,
    100,
  )

  latestSelectProps?.onChange('resume')

  expect(onDone).toHaveBeenCalledTimes(1)
  expect(onSubmitCommand).toHaveBeenCalledWith('/resume')
})

test('does not render when buddy is muted', async () => {
  mockConfig.companionMuted = true
  installBuddyMenuMocks()
  const { BuddyMenuDialog } = await importFreshBuddyMenuDialog()

  const output = await renderNode(
    <BuddyMenuDialog onDone={() => {}} onSubmitCommand={() => {}} />,
    100,
  )

  expect(output.trim()).toBe('')
})
