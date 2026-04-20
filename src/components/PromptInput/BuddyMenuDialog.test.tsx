import { afterEach, expect, mock, test } from 'bun:test'
import React from 'react'

let renderToStringFn: typeof import('../../utils/staticRender.tsx').renderToString

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
    errorFeeds: 0,
    recentPromptTurnAts: [],
    recentErrorFeedKeys: [],
    version: 2,
  },
  level: 1,
  mood: 'content' as const,
}

function installBuddyMenuMocks() {
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
    Select: ({ options }: { options: Array<{ label: React.ReactNode; description?: string }> }) => (
      <>
        {options.map((option, index) => (
          <div key={index}>
            <div>{option.label}</div>
            {option.description ? <div>{option.description}</div> : null}
          </div>
        ))}
      </>
    ),
  }))
}

afterEach(() => {
  mock.restore()
  mockConfig.companionMode = 'balanced'
  mockConfig.companionMuted = false
})

test('renders buddy actions menu', async () => {
  installBuddyMenuMocks()
  const { BuddyMenuDialog } = await importFreshBuddyMenuDialog()

  const output = await renderNode(
    <BuddyMenuDialog onDone={() => {}} onSubmitCommand={() => {}} />,
    100,
  )

  expect(output).toContain('Patch the Rare Owl ★★★')
  expect(output).toContain('Mode: Balanced')
  expect(output).toContain('Species: Owl')
  expect(output).toContain('Prompt turns: 2')
  expect(output).toContain('Actions')
  expect(output).not.toContain('Pet')
  expect(output).not.toContain('Status')
  expect(output).not.toContain('Rename')
  expect(output).not.toContain('Mute')
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
