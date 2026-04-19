import { expect, test } from 'bun:test'

import {
  decideCompanionVisualState,
  getActiveCompanionAnimationKind,
} from './visualState.js'

test('errorFeed animation has highest priority', () => {
  expect(
    getActiveCompanionAnimationKind({
      mood: 'content',
      now: 10_000,
      reaction: 'hello',
      petAt: 9_000,
      animation: { kind: 'errorFeed', at: 9_500 },
    }),
  ).toBe('errorFeed')
})

test('pet animation wins over speaking when no error feed is active', () => {
  expect(
    getActiveCompanionAnimationKind({
      mood: 'content',
      now: 10_000,
      reaction: 'hello',
      petAt: 9_000,
      animation: { kind: 'speak', at: 9_500 },
    }),
  ).toBe('pet')
})

test('expired errorFeed falls back to speak', () => {
  expect(
    getActiveCompanionAnimationKind({
      mood: 'content',
      now: 10_000,
      reaction: 'hello',
      animation: { kind: 'errorFeed', at: 1_000 },
    }),
  ).toBe('speak')
})

test('decideCompanionVisualState uses dedicated errorFeed sequence', () => {
  const decision = decideCompanionVisualState({
    mood: 'sleepy',
    now: 10_000,
    tick: 1,
    frameCount: 3,
    reaction: 'oops',
    animation: { kind: 'errorFeed', at: 9_500 },
  })

  expect(decision.activeKind).toBe('errorFeed')
  expect(decision.spriteFrame).toBe(1)
  expect(decision.blink).toBe(false)
})

test('recent errorFeed outranks pet and speaking together', () => {
  const decision = decideCompanionVisualState({
    mood: 'excited',
    now: 10_000,
    tick: 2,
    frameCount: 3,
    reaction: 'oops',
    petAt: 9_500,
    animation: { kind: 'errorFeed', at: 9_500 },
  })

  expect(decision.activeKind).toBe('errorFeed')
})

test('decideCompanionVisualState uses lonely idle blink when no higher state is active', () => {
  const decision = decideCompanionVisualState({
    mood: 'lonely',
    now: 10_000,
    tick: 2,
    frameCount: 3,
  })

  expect(decision.activeKind).toBe('idle')
  expect(decision.spriteFrame).toBe(0)
  expect(decision.blink).toBe(true)
})
