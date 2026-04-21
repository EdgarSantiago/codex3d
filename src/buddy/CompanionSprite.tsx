import { c as _c } from "react-compiler-runtime";
import figures from 'figures';
import React, { useEffect, useRef, useState } from 'react';
import { useTerminalSize } from '../hooks/useTerminalSize.js';
import { stringWidth } from '../ink/stringWidth.js';
import { Box, Text } from '../ink.js';
import { useAppState, useSetAppState } from '../state/AppState.js';
import type { AppState } from '../state/AppStateStore.js';
import { getGlobalConfig } from '../utils/config.js';
import { isFullscreenActive } from '../utils/fullscreen.js';
import type { Theme } from '../utils/theme.js';
import { getCompanion } from './companion.js';
import { isBuddyEnabled } from './feature.js';
import { renderFace, renderSprite, spriteFrameCount } from './sprites.js';
import { decideCompanionVisualState } from './visualState.js';
import { RARITY_COLORS } from './types.js';
const TICK_MS = 500;
const BUBBLE_SHOW = 20; // ticks → ~10s at 500ms
const FADE_WINDOW = 6; // last ~3s the bubble dims so you know it's about to go
const PET_BURST_MS = 2500; // how long hearts float after /buddy pet

// Idle sequence: mostly rest (frame 0), occasional fidget (frames 1-2), rare blink.
// Sequence indices map to sprite frames; -1 means "blink on frame 0".
const IDLE_SEQUENCE = [0, 0, 0, 0, 1, 0, 0, 0, -1, 0, 0, 2, 0, 0, 0];

// Hearts float up-and-out over 5 ticks (~2.5s). Prepended above the sprite.
const H = figures.heart;
const PET_HEARTS = [`   ${H}    ${H}   `, `  ${H}  ${H}   ${H}  `, ` ${H}   ${H}  ${H}   `, `${H}  ${H}      ${H} `, '·    ·   ·  '];
const ERROR_FEED_BURSTS = ['  ×  ×  ×   ', ' ×   !   ×  ', '×   ××   ×  ', ' ×   !   ×  ', '  ·  ·  ·   '];
const COMBO_BURSTS = ['  ✦  »  ✦   ', ' »   ✦   »  ', '✦   »»   ✦  ', ' »   ✦   »  ', '  ·  ·  ·   '];
const ACHIEVEMENT_BURSTS = ['  ★  ✦  ★   ', ' ✦   ★   ✦  ', '★   ✦✦   ★  ', ' ✦   ★   ✦  ', '  ·  ·  ·   '];
const LEVEL_UP_BURSTS = ['  ★  ✦  ★   ', ' ✦  +1  ✦   ', '★  LEVEL ★  ', ' ✦  UP! ✦   ', '  ·  ·  ·   '];
function wrap(text: string, width: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    if (cur.length + w.length + 1 > width && cur) {
      lines.push(cur);
      cur = w;
    } else {
      cur = cur ? `${cur} ${w}` : w;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}
function SpeechBubble(t0) {
  const $ = _c(54);
  const {
    text,
    color,
    fading,
    tail,
    variant = 'default'
  } = t0;
  const eventBorderColor = fading
    ? 'inactive'
    : variant === 'errorFeed'
      ? 'warning'
      : variant === 'combo'
        ? 'permission'
        : variant === 'achievement' || variant === 'levelUp'
          ? 'warning'
          : color;
  const borderStyle = variant === 'default' ? 'round' : 'single';
  const textColor = fading
    ? 'inactive'
    : variant === 'errorFeed'
      ? 'warning'
      : variant === 'combo'
        ? 'permission'
        : undefined;
  const badge = variant === 'levelUp'
    ? '★'
    : variant === 'achievement'
      ? '★'
      : variant === 'combo'
        ? '✦'
        : variant === 'errorFeed'
          ? '!'
          : undefined;
  const lines = wrap(text, 30);
  const topLines = badge ? lines.map((line, index) => index === 0 ? `${badge} ${line}` : line) : lines;
  const bubble = <Box flexDirection="column" borderStyle={borderStyle} borderColor={eventBorderColor} paddingX={1} width={34}>{topLines.map((l, i) => <Text key={i} italic={variant === 'default'} bold={variant !== 'default'} dimColor={!fading} color={textColor}>{l}</Text>)}</Box>;
  if (tail === "right") {
    const tailGlyph = variant === 'combo'
      ? '╾'
      : variant === 'levelUp' || variant === 'achievement'
        ? '═'
        : variant === 'errorFeed'
          ? '╍'
          : '─';
    return <Box flexDirection="row" alignItems="center">{bubble}<Text color={eventBorderColor}>{tailGlyph}</Text></Box>;
  }
  const downTail = variant === 'combo'
    ? ['╲ ', ' ╲']
    : variant === 'levelUp' || variant === 'achievement'
      ? ['║ ', '╲']
      : variant === 'errorFeed'
        ? ['╳ ', '╲']
        : ['╲ ', '╲'];
  return <Box flexDirection="column" alignItems="flex-end" marginRight={1}>{bubble}<Box flexDirection="column" alignItems="flex-end" paddingRight={6}><Text color={eventBorderColor}>{downTail[0]}</Text><Text color={eventBorderColor}>{downTail[1]}</Text></Box></Box>;
}
export const MIN_COLS_FOR_FULL_SPRITE = 100;
const SPRITE_BODY_WIDTH = 12;
const NAME_ROW_PAD = 2; // focused state wraps name in spaces: ` name `
const SPRITE_PADDING_X = 2;
const BUBBLE_WIDTH = 36; // SpeechBubble box (34) + tail column
const NARROW_QUIP_CAP = 24;
function spriteColWidth(nameWidth: number): number {
  return Math.max(SPRITE_BODY_WIDTH, nameWidth + NAME_ROW_PAD);
}

// Width the sprite area consumes. PromptInput subtracts this so text wraps
// correctly. In fullscreen the bubble floats over scrollback (no extra
// width); in non-fullscreen it sits inline and needs BUBBLE_WIDTH more.
// Narrow terminals: 0 — REPL.tsx stacks the one-liner on its own row
// (above input in fullscreen, below in scrollback), so no reservation.
export function companionReservedColumns(terminalColumns: number, speaking: boolean): number {
  if (!isBuddyEnabled()) return 0;
  const companion = getCompanion();
  if (!companion || getGlobalConfig().companionMuted) return 0;
  if (terminalColumns < MIN_COLS_FOR_FULL_SPRITE) return 0;
  const nameWidth = stringWidth(companion.name);
  const bubble = speaking && !isFullscreenActive() ? BUBBLE_WIDTH : 0;
  return spriteColWidth(nameWidth) + SPRITE_PADDING_X + bubble;
}
export function CompanionSprite(): React.ReactNode {
  const reaction = useAppState(s => s.companionReaction);
  const petAt = useAppState(s => s.companionPetAt);
  const animation = useAppState(s => s.companionAnimation);
  const focused = useAppState(s => s.footerSelection === 'companion');
  const setAppState = useSetAppState();
  const {
    columns
  } = useTerminalSize();
  const [tick, setTick] = useState(0);
  const lastSpokeTick = useRef(0);
  // Sync-during-render (not useEffect) so the first post-pet render already
  // has petStartTick=tick and petAge=0 — otherwise frame 0 is skipped.
  const [{
    petStartTick,
    forPetAt
  }, setPetStart] = useState({
    petStartTick: 0,
    forPetAt: petAt
  });
  if (petAt !== forPetAt) {
    setPetStart({
      petStartTick: tick,
      forPetAt: petAt
    });
  }
  useEffect(() => {
    const timer = setInterval(setT => setT((t: number) => t + 1), TICK_MS, setTick);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (!reaction) return;
    lastSpokeTick.current = tick;
    const timer = setTimeout(setA => setA((prev: AppState) => prev.companionReaction === undefined ? prev : {
      ...prev,
      companionReaction: undefined
    }), BUBBLE_SHOW * TICK_MS, setAppState);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- tick intentionally captured at reaction-change, not tracked
  }, [reaction, setAppState]);
  if (!isBuddyEnabled()) return null;
  const companion = getCompanion();
  if (!companion || getGlobalConfig().companionMuted) return null;
  const color = RARITY_COLORS[companion.rarity];
  const colWidth = spriteColWidth(stringWidth(companion.name));
  const bubbleAge = reaction ? tick - lastSpokeTick.current : 0;
  const fading = reaction !== undefined && bubbleAge >= BUBBLE_SHOW - FADE_WINDOW;
  const petAge = petAt ? tick - petStartTick : Infinity;
  const petting = petAge * TICK_MS < PET_BURST_MS;
  const mood = companion.mood;

  // Narrow terminals: collapse to one-line face. When speaking, the quip
  // replaces the name beside the face (no room for a bubble).
  if (columns < MIN_COLS_FOR_FULL_SPRITE) {
    const quip = reaction && reaction.length > NARROW_QUIP_CAP ? reaction.slice(0, NARROW_QUIP_CAP - 1) + '…' : reaction;
    const label = quip ? `"${quip}"` : focused ? ` ${companion.name} ` : companion.name;
    const narrowPrefix = animation?.kind === 'levelUp' ? <Text color="warning">▲ </Text> : animation?.kind === 'achievement' ? <Text color="warning">★ </Text> : animation?.kind === 'combo' ? <Text color="permission">✦ </Text> : animation?.kind === 'errorFeed' ? <Text color="warning">× </Text> : petting ? <Text color="autoAccept">{figures.heart} </Text> : null;
    return <Box paddingX={1} alignSelf="flex-end">
        <Text>
          {narrowPrefix}
          <Text bold color={color}>
            {renderFace(companion)}
          </Text>{' '}
          <Text italic dimColor={!focused && !reaction} bold={focused} inverse={focused && !reaction} color={reaction ? fading ? 'inactive' : color : focused ? color : undefined}>
            {label}
          </Text>
        </Text>
      </Box>;
  }
  const frameCount = spriteFrameCount(companion.species);
  const visualDecision = decideCompanionVisualState({
    mood,
    now: Date.now(),
    tick,
    frameCount,
    reaction,
    petAt,
    animation,
  });
  const effectFrame = visualDecision.activeKind === 'pet' ? PET_HEARTS[petAge % PET_HEARTS.length] : visualDecision.activeKind === 'levelUp' ? LEVEL_UP_BURSTS[tick % LEVEL_UP_BURSTS.length] : visualDecision.activeKind === 'achievement' ? ACHIEVEMENT_BURSTS[tick % ACHIEVEMENT_BURSTS.length] : visualDecision.activeKind === 'combo' ? COMBO_BURSTS[tick % COMBO_BURSTS.length] : visualDecision.activeKind === 'errorFeed' ? ERROR_FEED_BURSTS[tick % ERROR_FEED_BURSTS.length] : null;
  const bubbleVariant = visualDecision.activeKind === 'levelUp' || visualDecision.activeKind === 'achievement' || visualDecision.activeKind === 'combo' || visualDecision.activeKind === 'errorFeed'
    ? visualDecision.activeKind
    : 'default';
  const spriteFrame = visualDecision.spriteFrame;
  const blink = visualDecision.blink;
  const body = renderSprite(companion, spriteFrame).map(line => blink ? line.replaceAll(companion.eye, '-') : line);
  const sprite = effectFrame ? [effectFrame, ...body] : body;

  // Name row doubles as hint row — unfocused shows dim name + ↓ discovery,
  // focused shows inverse name. The enter-to-open hint lives in
  // PromptInputFooter's right column so this row stays one line and the
  // sprite doesn't jump up when selected. flexShrink=0 stops the
  // inline-bubble row wrapper from squeezing the sprite to fit.
  const spriteColumn = <Box flexDirection="column" flexShrink={0} alignItems="center" width={colWidth}>
      {sprite.map((line, i) => <Text key={i} color={i === 0 && visualDecision.activeKind === 'pet' ? 'autoAccept' : i === 0 && visualDecision.activeKind === 'levelUp' ? 'warning' : i === 0 && visualDecision.activeKind === 'achievement' ? 'warning' : i === 0 && visualDecision.activeKind === 'combo' ? 'permission' : i === 0 && visualDecision.activeKind === 'errorFeed' ? 'warning' : color}>
          {line}
        </Text>)}
      <Text italic bold={focused} dimColor={!focused} color={focused ? color : undefined} inverse={focused}>
        {focused ? ` ${companion.name} ` : companion.name}
      </Text>
    </Box>;
  if (!reaction) {
    return <Box paddingX={1}>{spriteColumn}</Box>;
  }

  // Fullscreen: bubble renders separately via CompanionFloatingBubble in
  // FullscreenLayout's bottomFloat slot (the bottom slot's overflowY:hidden
  // would clip a position:absolute overlay here). Sprite body only.
  // Non-fullscreen: bubble sits inline beside the sprite (input shrinks)
  // because floating into Static scrollback can't be cleared.
  if (isFullscreenActive()) {
    return <Box paddingX={1}>{spriteColumn}</Box>;
  }
  return <Box flexDirection="row" alignItems="flex-end" paddingX={1} flexShrink={0}>
      <SpeechBubble text={reaction} color={color} fading={fading} tail="right" variant={bubbleVariant} />
      {spriteColumn}
    </Box>;
}

// Floating bubble overlay for fullscreen mode. Mounted in FullscreenLayout's
// bottomFloat slot (outside the overflowY:hidden clip) so it can extend into
// the ScrollBox region. CompanionSprite owns the clear-after-10s timer; this
// just reads companionReaction and renders the fade.
export function CompanionFloatingBubble() {
  const $ = _c(8);
  const reaction = useAppState(_temp);
  const animation = useAppState(s => s.companionAnimation);
  let t0;
  if ($[0] !== reaction) {
    t0 = {
      tick: 0,
      forReaction: reaction
    };
    $[0] = reaction;
    $[1] = t0;
  } else {
    t0 = $[1];
  }
  const [t1, setTick] = useState(t0);
  const {
    tick,
    forReaction
  } = t1;
  if (reaction !== forReaction) {
    setTick({
      tick: 0,
      forReaction: reaction
    });
  }
  let t2;
  let t3;
  if ($[2] !== reaction) {
    t2 = () => {
      if (!reaction) {
        return;
      }
      const timer = setInterval(_temp3, TICK_MS, setTick);
      return () => clearInterval(timer);
    };
    t3 = [reaction];
    $[2] = reaction;
    $[3] = t2;
    $[4] = t3;
  } else {
    t2 = $[3];
    t3 = $[4];
  }
  useEffect(t2, t3);
  if (!isBuddyEnabled() || !reaction) {
    return null;
  }
  const companion = getCompanion();
  if (!companion || getGlobalConfig().companionMuted) {
    return null;
  }
  const t4 = tick >= BUBBLE_SHOW - FADE_WINDOW;
  let t5;
  if ($[5] !== animation?.kind || $[6] !== reaction || $[7] !== t4) {
    const variant = animation?.kind === 'levelUp' ||
        animation?.kind === 'achievement' ||
        animation?.kind === 'combo' ||
        animation?.kind === 'errorFeed'
      ? animation.kind
      : 'default';
    t5 = <SpeechBubble text={reaction} color={RARITY_COLORS[companion.rarity]} fading={t4} tail="down" variant={variant} />;
    $[5] = animation?.kind;
    $[6] = reaction;
    $[7] = t4;
    $[8] = t5;
  } else {
    t5 = $[8];
  }
  return t5;
}
function _temp3(set) {
  return set(_temp2);
}
function _temp2(s_0) {
  return {
    ...s_0,
    tick: s_0.tick + 1
  };
}
function _temp(s) {
  return s.companionReaction;
}
