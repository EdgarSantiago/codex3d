# Buddy Feature Context

This document captures the current state of the `/buddy` system so future work can continue with the right context.

## Overview

The buddy system is now a companion/progression feature inside the CLI.

It currently supports:
- one active buddy
- companion management commands
- persistent XP and mood progression
- prompt-turn XP
- error feeding from real tool failures
- mood-aware cyber commentary
- transient visual-state animation
- a dedicated error-fed animation state
- buddy modes for token-safe vs richer behavior

The architecture is intentionally split into:
- **persisted progression/state** in config-backed buddy data
- **derived runtime state** like level and mood
- **transient UI state** for short-lived reactions and animations

---

## Buddy mode rule

**All future buddy features must respect buddy mode.**

Current modes:
- `minimal` — token-safe; disables buddy commentary and model-facing buddy context
- `balanced` — enables local buddy commentary but keeps model-facing buddy context off
- `expressive` — enables commentary plus model-facing buddy context

Design rule going forward:
- local buddy systems like XP, mood, error feeding, and animation should continue to work in all modes
- token-sensitive systems such as commentary frequency, prompt attachment context, and future model-visible buddy memory must be gated by buddy mode
- new buddy work should default to `balanced` unless there is a strong reason otherwise
- every new buddy feature should explicitly define what happens in `minimal`, `balanced`, and `expressive`

Relevant files:
- `src/buddy/types.ts`
- `src/utils/config.ts`
- `src/commands/buddy/buddy.tsx`
- `src/buddy/observer.ts`
- `src/buddy/prompt.ts`

---

## Buddy modes

The buddy now has three behavior modes.

### `minimal`
- keeps XP, levels, mood, error feeding, and animations active
- disables buddy commentary
- disables model-facing companion prompt attachment/context
- intended for lower token usage

### `balanced`
- enables local buddy commentary
- keeps model-facing companion prompt attachment/context off
- intended as the default mode

### `expressive`
- enables local buddy commentary
- enables model-facing companion prompt attachment/context
- intended for the richest buddy behavior

Main implementation:
- `src/buddy/types.ts`
- `src/commands/buddy/buddy.tsx`
- `src/buddy/observer.ts`
- `src/buddy/prompt.ts`

---

## Mode-sensitive areas

These buddy areas already respect buddy mode:
- buddy commentary in `src/buddy/observer.ts`
- model-facing companion attachment in `src/buddy/prompt.ts`
- mode control and status display in `src/commands/buddy/buddy.tsx`

These areas should remain mode-aware for future work:
- future milestone narration
- future buddy memory/context injection
- future expressive commentary sets
- any future model-visible buddy summaries or prompt augmentations

These areas should stay local-only and mode-independent unless product requirements change:
- XP and progression logic
- mood derivation
- error feeding
- animation state and ASCII rendering
- local `/buddy` management operations

---

## Current user-facing features

### 1. Buddy management
The buddy is still a **single active companion**.

Supported command flows:
- `/buddy`
- `/buddy status`
- `/buddy mode`
- `/buddy mode <minimal|balanced|expressive>`
- `/buddy rename <name>`
- `/buddy edit personality <text>`
- `/buddy reset`
- `/buddy reroll`
- `/buddy mute`
- `/buddy unmute`
- `/buddy help`

Main implementation:
- `src/commands/buddy/buddy.tsx`
- `src/commands/buddy/index.ts`

### 2. Persistent progression
The buddy now stores progression data in config.

Persisted progress currently includes:
- `xpTotal`
- `promptTurns`
- `errorFeeds`
- `lastPromptAt`
- `recentPromptTurnAts`
- `recentErrorFeedKeys`
- `version`

Types:
- `src/buddy/types.ts`

Pure progression logic:
- `src/buddy/progression.ts`

### 3. Level system
Level is derived from XP at read time.

It is **not persisted directly**.

Main logic:
- `getBuddyLevel(...)` in `src/buddy/progression.ts`

### 4. Mood system
Mood is derived from recent prompt activity.

Current moods:
- `excited`
- `content`
- `sleepy`
- `lonely`

Mood is **not persisted directly**.

Main logic:
- `getBuddyMood(...)` in `src/buddy/progression.ts`

### 5. Prompt-turn XP
Buddy gains XP from real prompt turns that actually become Claude queries.

Important rule:
- `/buddy` itself should not farm prompt XP
- non-query slash commands should not grant prompt XP
- blocked/meta prompts should not grant prompt XP

Hook location:
- `src/utils/processUserInput/processUserInput.ts`

### 6. Error feeding
Buddy can now "eat" real tool execution failures and gain bonus XP.

Important rules:
- only real `tool.call(...)` failures count
- permission denials / validation failures / hook stops should not count
- `AbortError` should not count
- duplicate failures are deduped using a feed key

Main integration:
- `src/services/tools/toolExecution.ts`
- `awardBuddyToolError(...)` in `src/commands/buddy/buddy.tsx`
- `tool_error` event handling in `src/buddy/progression.ts`

### 7. Mood-aware cyber commentary
Buddy commentary is now mood-aware.

Current behavior:
- direct mentions can produce mood-specific quips
- `/buddy` pet reactions are mood-aware
- error-themed prompts can surface error-related commentary if recent error-feed data exists

Main implementation:
- `src/buddy/observer.ts`

### 8. Visual-state animation framework
Animation is no longer only based on pet + reaction + mood ad hoc logic.

There is now a transient visual-state layer with kinds:
- `idle`
- `pet`
- `speak`
- `errorFeed`

Priority is handled in a pure helper.

Main files:
- `src/buddy/visualState.ts`
- `src/state/AppStateStore.ts`
- `src/buddy/CompanionSprite.tsx`

### 9. Dedicated error-fed animation state
When a real tool error is fed to the buddy, the renderer can now enter a dedicated `errorFeed` visual state.

That state currently:
- outranks pet/speaking/idle in priority
- uses a dedicated animation sequence
- shows a more distinct effect in narrow and full modes

Main files:
- `src/buddy/visualState.ts`
- `src/buddy/CompanionSprite.tsx`
- `src/services/tools/toolExecution.ts`

### 10. Buddy mode configuration
Buddy behavior can now be configured by mode.

Main behavior:
- `/buddy mode` shows current mode
- `/buddy mode <minimal|balanced|expressive>` changes mode
- `/buddy status` shows the current mode

Main files:
- `src/commands/buddy/buddy.tsx`
- `src/buddy/types.ts`
- `src/utils/config.ts`

---

## Architecture summary

### Persisted buddy data
The persisted buddy record lives in global config as a single `companion` object.

Relevant files:
- `src/utils/config.ts`
- `src/buddy/types.ts`

Persisted fields include:
- companion soul fields (`name`, `personality`, `hatchedAt`, `seed`)
- progression object
- `companionMode`

### Derived runtime buddy state
The runtime buddy is assembled by combining:
- deterministic generated bones
- persisted soul/progression
- derived fields like `level` and `mood`

Relevant file:
- `src/buddy/companion.ts`

### Transient UI state
Short-lived reactions and animation priorities live in app state.

Relevant file:
- `src/state/AppStateStore.ts`

Current transient buddy UI fields:
- `companionReaction`
- `companionPetAt`
- `companionAnimation`

---

## Important implementation files

### Core buddy model
- `src/buddy/types.ts`
- `src/buddy/progression.ts`
- `src/buddy/companion.ts`

### Commands and progression writes
- `src/commands/buddy/buddy.tsx`
- `src/commands/buddy/index.ts`

### Commentary
- `src/buddy/observer.ts`

### Rendering / animation
- `src/buddy/CompanionSprite.tsx`
- `src/buddy/visualState.ts`
- `src/buddy/sprites.ts`

### Event hooks
- `src/utils/processUserInput/processUserInput.ts` for prompt-turn XP
- `src/services/tools/toolExecution.ts` for error feeding

### Mode gating
- `src/buddy/types.ts`
- `src/buddy/prompt.ts`
- `src/buddy/observer.ts`
- `src/commands/buddy/buddy.tsx`

---

## Current test coverage

Focused test files currently in place:
- `src/buddy/progression.test.ts`
- `src/buddy/companion.test.ts`
- `src/buddy/observer.test.ts`
- `src/buddy/visualState.test.ts`
- `src/commands/buddy/buddy.test.ts`

Useful commands:
- `bun test "/Users/edgar/projects/codex3d/src/buddy/progression.test.ts"`
- `bun test "/Users/edgar/projects/codex3d/src/buddy/observer.test.ts"`
- `bun test "/Users/edgar/projects/codex3d/src/buddy/visualState.test.ts"`
- `bun test "/Users/edgar/projects/codex3d/src/buddy/progression.test.ts" "/Users/edgar/projects/codex3d/src/buddy/companion.test.ts" "/Users/edgar/projects/codex3d/src/commands/buddy/buddy.test.ts"`

The earlier Bun cross-file mock collision was addressed by making the config mock in `src/buddy/companion.test.ts` expose `saveGlobalConfig` too.

---

## Current visual-state priority

The intended animation priority is:
1. `errorFeed`
2. `pet`
3. `speak`
4. mood-driven idle

That logic lives in:
- `src/buddy/visualState.ts`

---

## Constraints to keep in mind

### Layout constraints
Sprite rendering is sensitive to terminal width.

Important files:
- `src/buddy/CompanionSprite.tsx`
- `src/buddy/sprites.ts`

Important facts:
- narrow terminals collapse to a one-line face/label mode
- fullscreen uses a floating bubble path
- inline layout reserves width in normal mode
- sprite dimensions should remain stable to avoid layout jumps

### Persistence constraints
Progression is persistent.
Visual-state animation is **transient only** and should stay out of persisted config.

### Feature scope constraints
The system is still designed around:
- one active buddy
- local companion UI/state
- light ambient reactions, not a heavy game system

### Buddy mode constraint
This is now a hard rule for future work:
- **every new buddy feature must define how it behaves in `minimal`, `balanced`, and `expressive` mode**
- token-sensitive buddy features must never bypass mode gating
- local buddy features should remain available in all modes unless there is a deliberate product decision to do otherwise

---

## Good next phases

### A. Level-up milestones
Give progression more payoff.

Ideas:
- level-up reaction bubble
- special animation on level-up
- unlock commentary sets by level band

Likely files:
- `src/commands/buddy/buddy.tsx`
- `src/buddy/observer.ts`
- `src/buddy/CompanionSprite.tsx`
- `src/buddy/progression.ts`

**Mode rule:**
- local level-up animation should work in all modes
- commentary about level-ups should be gated by buddy mode
- any model-facing milestone context should be expressive-only

### B. Species-specific special animations
Add custom error-feed or celebration sequences by species.

Likely files:
- `src/buddy/sprites.ts`
- `src/buddy/visualState.ts`
- `src/buddy/CompanionSprite.tsx`

**Mode rule:**
- purely visual species-specific animation can remain active in all modes

### C. Buddy memory of recent notable events
Track richer recent events for commentary.

Examples:
- last level up
- last error fed
- last pet
- last rename

Likely files:
- `src/buddy/types.ts`
- `src/buddy/progression.ts`
- `src/buddy/observer.ts`

**Mode rule:**
- local memory storage can exist in all modes
- commentary that uses it must be gated by mode
- prompt/model-facing memory use should be expressive-only

### D. More `/buddy` commands
Possible future commands:
- `/buddy stats`
- `/buddy history`
- `/buddy mood`
- `/buddy milestones`

Main file:
- `src/commands/buddy/buddy.tsx`

**Mode rule:**
- local status commands can work in all modes
- any command that would create buddy prompt/context narration must respect mode

---

## Recommended next step

If continuing immediately, the highest-value next phase is:

**level-up milestones**

Why:
- progression already exists
- mood and XP already work
- commentary already exists
- animation framework already exists
- a level-up payoff would connect all the current systems together
- it can be implemented cleanly while respecting buddy modes

---

## Short handoff summary

The buddy system now has:
- management commands
- persistent XP and mood foundation
- prompt-turn XP
- error feeding with dedupe
- mood-aware cyber commentary
- a transient animation-state framework
- a dedicated error-fed animation state
- buddy modes (`minimal`, `balanced`, `expressive`)
- focused test coverage for progression, observer, visual-state, companion reconstruction, and buddy commands

Most important future rule:

**All new buddy features must respect buddy mode.**

This file should be enough context to continue feature work without re-discovering the architecture.
