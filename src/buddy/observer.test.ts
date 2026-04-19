import { afterEach, expect, mock, test } from 'bun:test'

import type { StoredCompanion } from './types.js'

let muted = false
let companion: {
  name: string
  personality: string
  mood: 'excited' | 'content' | 'sleepy' | 'lonely'
  progress: { recentErrorFeedKeys: string[] }
} | undefined

let mode: 'minimal' | 'balanced' | 'expressive' = 'balanced'

function installObserverMocks() {
  mock.module('../utils/config.js', () => ({
    getGlobalConfig: () => ({ companionMuted: muted, companionMode: mode }),
  }))
  mock.module('./companion.js', () => ({
    getCompanion: () => companion,
  }))
  mock.module('../utils/messages.js', () => ({
    getUserMessageText: (msg: { text?: string }) => msg.text,
  }))
}

async function importFreshObserverModule() {
  return import(`./observer.ts?ts=${Date.now()}-${Math.random()}`)
}

afterEach(() => {
  mock.restore()
  muted = false
  mode = 'balanced'
  companion = undefined
})

test('direct mentions use mood-aware commentary', async () => {
  companion = {
    name: 'Vectordot',
    personality: 'Curious and quietly encouraging.',
    mood: 'lonely',
    progress: { recentErrorFeedKeys: [] },
  }
  installObserverMocks()
  const observer = await importFreshObserverModule()
  let reaction: string | undefined

  await observer.fireCompanionObserver(
    [{ type: 'user', text: 'hey buddy are you there?' }] as never,
    value => {
      reaction = value
    },
  )

  expect(reaction).toContain('Vectordot:')
  expect(reaction).toMatch(/quiet|outage|pulse|At last/i)
})

test('slash buddy uses mood-aware pet reactions', async () => {
  companion = {
    name: 'Vectordot',
    personality: 'Curious and quietly encouraging.',
    mood: 'excited',
    progress: { recentErrorFeedKeys: [] },
  }
  installObserverMocks()
  const observer = await importFreshObserverModule()
  let reaction: string | undefined

  await observer.fireCompanionObserver(
    [{ type: 'user', text: '/buddy' }] as never,
    value => {
      reaction = value
    },
  )

  expect(reaction).toBeTruthy()
  expect(reaction).not.toContain('Vectordot:')
})

test('error-themed prompts can trigger error commentary when an error feed exists', async () => {
  companion = {
    name: 'Vectordot',
    personality: 'Curious and quietly encouraging.',
    mood: 'content',
    progress: { recentErrorFeedKeys: ['chain-1:Read:Error'] },
  }
  installObserverMocks()
  const observer = await importFreshObserverModule()
  let reaction: string | undefined

  await observer.fireCompanionObserver(
    [{ type: 'user', text: 'that error failed again' }] as never,
    value => {
      reaction = value
    },
  )

  expect(reaction).toContain('Vectordot:')
  expect(reaction).toMatch(/error|bytes|digested|fuel/i)
})

test('minimal mode disables commentary', async () => {
  mode = 'minimal'
  companion = {
    name: 'Vectordot',
    personality: 'Curious and quietly encouraging.',
    mood: 'content',
    progress: { recentErrorFeedKeys: ['chain-1:Read:Error'] },
  }
  installObserverMocks()
  const observer = await importFreshObserverModule()
  let reaction = 'unset'

  await observer.fireCompanionObserver(
    [{ type: 'user', text: 'buddy?' }] as never,
    value => {
      reaction = value ?? 'none'
    },
  )

  expect(reaction).toBe('unset')
})

test('muted buddy does not react', async () => {
  muted = true
  companion = {
    name: 'Vectordot',
    personality: 'Curious and quietly encouraging.',
    mood: 'content',
    progress: { recentErrorFeedKeys: ['chain-1:Read:Error'] },
  }
  installObserverMocks()
  const observer = await importFreshObserverModule()
  let reaction = 'unset'

  await observer.fireCompanionObserver(
    [{ type: 'user', text: 'buddy?' }] as never,
    value => {
      reaction = value ?? 'none'
    },
  )

  expect(reaction).toBe('unset')
})
