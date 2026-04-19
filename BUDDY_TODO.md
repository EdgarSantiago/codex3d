# Buddy TODO

Concise follow-up roadmap for the buddy system.

## Current state

Already implemented:
- single active buddy management
- persistent XP and mood progression
- prompt-turn XP
- error feeding with dedupe
- mood-aware cyber commentary
- transient animation-state framework
- dedicated error-fed animation state
- buddy modes (`minimal`, `balanced`, `expressive`)
- focused buddy test coverage

Hard rule for future work:
- every new buddy feature must explicitly respect buddy mode
- local-only buddy features can usually stay active in all modes
- token-sensitive commentary or model-facing buddy context must be gated by mode
- default behavior should continue to target `balanced` unless there is a strong reason otherwise

Current mode intent:
- `minimal` = token-safe
- `balanced` = local commentary only
- `expressive` = commentary plus model-facing buddy context

Reference docs:
- `BUDDY_CONTEXT.md`
- `BUDDY_TODO.md`

---

## Highest-value next phase

### 1. Level-up milestones

Why:
- progression now exists, but it needs stronger payoff
- this connects XP, mood, commentary, and animation into something more rewarding

Good additions:
- level-up reaction bubble
- level-up animation state
- milestone commentary by level band
- optional cosmetic unlocks tied to level thresholds

Likely files:
- `src/buddy/progression.ts`
- `src/commands/buddy/buddy.tsx`
- `src/buddy/observer.ts`
- `src/buddy/CompanionSprite.tsx`
- `src/buddy/visualState.ts`

---

## Strong follow-up phases

### 2. Species-specific special animations

Goal:
- make different buddy species feel more unique

Ideas:
- species-specific error-feed bursts
- species-specific pet reactions
- species-specific level-up animations

Likely files:
- `src/buddy/sprites.ts`
- `src/buddy/visualState.ts`
- `src/buddy/CompanionSprite.tsx`

### 3. Buddy memory of notable events

Goal:
- let commentary feel more contextual and less generic

Possible tracked events:
- last level up
- last error fed
- last pet
- last rename
- streak milestones

Likely files:
- `src/buddy/types.ts`
- `src/buddy/progression.ts`
- `src/buddy/observer.ts`

### 4. Streaks / return bonuses

Goal:
- reward sustained CLI usage over time

Ideas:
- daily or weekly streaks
- comeback commentary when the user returns
- small XP bonus for maintaining streaks

Likely files:
- `src/buddy/progression.ts`
- `src/utils/processUserInput/processUserInput.ts`
- `src/buddy/observer.ts`

### 5. More `/buddy` commands

Possible commands:
- `/buddy stats`
- `/buddy mood`
- `/buddy history`
- `/buddy milestones`

Likely file:
- `src/commands/buddy/buddy.tsx`

---

## Technical cleanup items

### 6. Keep buddy tests stable

Current buddy-focused test files:
- `src/buddy/progression.test.ts`
- `src/buddy/companion.test.ts`
- `src/buddy/observer.test.ts`
- `src/buddy/visualState.test.ts`
- `src/commands/buddy/buddy.test.ts`

Keep adding pure helpers where possible so animation and progression logic stay easy to test without heavy React or Bun mocking.

### 7. Avoid persistence creep

Rules worth preserving:
- keep visual animation state transient in app state
- keep level and mood derived at read time
- keep one active buddy model unless the product direction explicitly changes

---

## Suggested implementation order

1. Level-up milestones
2. Species-specific special animations
3. Buddy memory of notable events
4. Streaks / return bonuses
5. Extra `/buddy` commands

---

## Short handoff

If continuing later, start by reading:
1. `BUDDY_CONTEXT.md`
2. `BUDDY_TODO.md`

Then continue with **level-up milestones** as the next recommended feature slice.
