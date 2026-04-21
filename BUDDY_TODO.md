# Buddy TODO

Concise follow-up roadmap for the buddy system.

## Current state

Already implemented:
- single active buddy management
- persistent XP and mood progression
- productivity-driven progression (productive turns, work time, combos, streaks)
- passive achievement unlocking from local progress
- token-aware prompt-turn XP (base XP plus token-scaled bonus)
- error feeding with dedupe
- `/buddy status` level and next-level progress surfacing
- compact buddy XP progress in the prompt footer
- richer buddy menu/status productivity dashboard
- mood-aware cyber commentary
- transient animation-state framework
- dedicated event animation states for `errorFeed`, `combo`, `achievement`, and `levelUp`
- game-like ASCII burst art for milestone moments
- RPG-style special-event speech bubble variants
- buddy modes (`minimal`, `balanced`, `expressive`)
- focused buddy test coverage
- footer and progression test coverage for buddy progress UI

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

## Features that do **not** spend tokens

These are good candidates to build without affecting token usage in a meaningful way, as long as they stay local/UI-only.

### 1. Level-up milestones
Why:
- progression now exists, but it needs stronger payoff
- this connects XP, mood, commentary, and animation into something more rewarding

Already landed:
- level-up reaction bubble
- level-up animation state
- dedicated level-up burst art and speech bubble styling

Still open:
- optional cosmetic unlocks tied to level thresholds

Likely files:
- `src/buddy/progression.ts`
- `src/commands/buddy/buddy.tsx`
- `src/buddy/CompanionSprite.tsx`
- `src/buddy/visualState.ts`

Mode rule:
- local level-up animation should work in all modes
- if level-up also gets commentary later, that commentary must be mode-gated

### 2. More local `/buddy` commands
Possible commands:
- `/buddy stats`
- `/buddy mood`
- `/buddy milestones`
- `/buddy xp`
- `/buddy level`
- `/buddy rarity`

Likely file:
- `src/commands/buddy/buddy.tsx`

Mode rule:
- local status commands can work in all modes
- avoid turning these into model-facing narration in minimal/balanced unless explicitly intended

### 3. Cosmetic unlocks that stay local
Ideas:
- unlock color accents by level
- unlock local title labels
- unlock bubble border styles
- unlock local sprite effect variants

Likely files:
- `src/buddy/progression.ts`
- `src/buddy/CompanionSprite.tsx`
- `src/buddy/visualState.ts`

Mode rule:
- cosmetic presentation can remain active in all modes

### 4. More local animation polish
Ideas:
- smoother level-up animation timing
- stronger pet animation timing
- better idle variety by mood
- cleaner animation transitions between pet/speak/errorFeed

Likely files:
- `src/buddy/visualState.ts`
- `src/buddy/CompanionSprite.tsx`
- `src/buddy/sprites.ts`

Mode rule:
- purely visual animation work can remain active in all modes

### 5. Local achievements / badges
Already landed:
- passive local achievements derived from progress
- badge surfacing in `/buddy status`
- achievement-triggered animation state and speech bubble styling

Still open:
- expand the achievement set further if needed

Likely files:
- `src/buddy/types.ts`
- `src/buddy/progression.ts`
- `src/commands/buddy/buddy.tsx`

Mode rule:
- local achievement tracking can exist in all modes
- achievement narration must be gated if it becomes commentary later

### 6. Test and rendering polish
Examples:
- improve visual-state tests
- more pure helpers for animation decisions
- keep narrow/fullscreen rendering stable
- keep sprite dimensions from causing layout jumps
- strengthen combined buddy suite coverage

Likely files:
- `src/buddy/visualState.test.ts`
- `src/buddy/CompanionSprite.tsx`
- `src/buddy/sprites.ts`
- `src/commands/buddy/buddy.test.ts`

### 7. Better local status surfacing
Already landed:
- next level threshold in `/buddy status`
- compact buddy XP progress in the prompt footer
- productivity dashboard in `/buddy status`
- combo / streak / badge surfacing in local buddy UI

Remaining ideas:
- show recent local activity summary
- show current mode explanation inline
- show local unlock progress

Likely files:
- `src/commands/buddy/buddy.tsx`
- `src/buddy/progression.ts`

Mode rule:
- local status output can work in all modes

---

## Features that **can** spend tokens

These features are the ones that can increase token usage if they surface more commentary or model-visible buddy context.

### 8. Milestone commentary
Goal:
- let level progression feel more alive with milestone-specific narration

Ideas:
- level-up commentary by level band
- milestone-specific quips
- special reactions when thresholds are crossed

Likely files:
- `src/buddy/observer.ts`
- `src/commands/buddy/buddy.tsx`
- `src/buddy/progression.ts`

Mode rule:
- `minimal`: off
- `balanced`: light/local commentary only
- `expressive`: richest commentary allowed

### 9. Buddy memory of notable events
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

Mode rule:
- local memory storage can exist in all modes
- commentary that uses it must be gated by mode
- prompt/model-facing memory use should be expressive-only

### 10. Streaks / return bonuses
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

Mode rule:
- streak counters can be local in all modes
- streak commentary must respect mode
- any model-visible streak context should be expressive-only

### 11. History / narrative `/buddy` commands
Possible commands:
- `/buddy history`
- `/buddy feed`
- `/buddy journal`

Likely file:
- `src/commands/buddy/buddy.tsx`

Mode rule:
- if these commands stay local summaries, they are fine in all modes
- if they create richer narration or model-facing context, they must be mode-gated

### 12. Expressive buddy prompt context
Ideas:
- richer companion intro text
- mode-aware prompt attachment content
- future model-facing buddy summaries

Likely files:
- `src/buddy/prompt.ts`
- `src/buddy/types.ts`

Mode rule:
- expressive-only

---

## Technical cleanup items

### 13. Keep buddy tests stable
Current buddy-focused test files:
- `src/buddy/progression.test.ts`
- `src/buddy/companion.test.ts`
- `src/buddy/observer.test.ts`
- `src/buddy/visualState.test.ts`
- `src/commands/buddy/buddy.test.ts`

Keep adding pure helpers where possible so animation and progression logic stay easy to test without heavy React or Bun mocking.

### 14. Avoid persistence creep
Rules worth preserving:
- keep visual animation state transient in app state
- keep level and mood derived at read time
- keep one active buddy model unless the product direction explicitly changes
- keep token-sensitive behavior explicitly separated from local buddy behavior

---

## Suggested implementation order

### Lowest token-impact path
1. Level-up milestones
2. More local `/buddy` commands
3. Cosmetic unlocks that stay local
4. More local animation polish
5. Local achievements / badges
6. Test/rendering polish
7. Better local status surfacing

### Richer behavior path
8. Milestone commentary
9. Buddy memory of notable events
10. Streaks / return bonuses
11. History / narrative `/buddy` commands
12. Expressive buddy prompt context

---

## Short handoff

If continuing later, start by reading:
1. `BUDDY_CONTEXT.md`
2. `BUDDY_TODO.md`

If the goal is **low token impact**, continue with:
- **level-up milestones**

If the goal is **richer personality and context**, continue with:
- **milestone commentary**
