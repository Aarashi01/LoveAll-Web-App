# Quick Match Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a local-only one-off match scorer at `/quick` reachable without an account, with user-set points-to-win + best-of + deuce, plus prominent "Quick Match — no login required" CTAs on `/login` and `/dashboard`.

**Architecture:** Pure scoring engine (`lib/quick-match-engine.ts`) + Zustand store (in-memory, not persisted) + two screens (setup + play/complete) + a reusable CTA button. No Firestore writes, no auth, no rules changes.

**Tech Stack:** Expo SDK 54 + React Native Web · expo-router 6 · Zustand · Jest (already configured in this repo). UI primitives: `AppButton`, `AppCard`, `AppInput` from `components/ui/`.

**Spec:** `docs/superpowers/specs/2026-05-04-quick-match-design.md`

**Discovery note:** `app/_layout.tsx` does NOT contain a global auth guard — auth redirects live inside individual screens (`app/(auth)/login.tsx`, `app/(organizer)/dashboard.tsx`). Therefore `/quick/*` does not need a global exemption; it's open by default as long as those files don't import `useAuth`. The spec's "modify auth-redirect guard" item is dropped.

---

## File Map

**New files**

| Path | Responsibility |
|---|---|
| `lib/quick-match-engine.ts` | Pure scoring functions (no state). |
| `store/quick-match.store.ts` | Zustand slice holding the in-progress `QuickMatch`. |
| `components/quick/QuickMatchButton.tsx` | Reusable CTA used on `/login` and `/dashboard`. |
| `app/quick/_layout.tsx` | Bare Stack layout, no auth. |
| `app/quick/index.tsx` | Setup form → starts a match → navigates to `/quick/play`. |
| `app/quick/play.tsx` | Scoring + Complete state in one screen. |
| `tests/lib/quick-match-engine.test.ts` | Jest unit tests for the engine. |

**Modified files**

| Path | Change |
|---|---|
| `app/(auth)/login.tsx` | Mount `<QuickMatchButton />` below the existing form. |
| `app/(organizer)/dashboard.tsx` | Mount `<QuickMatchButton />` near the top. |

**Not modified:** `app/_layout.tsx` (no global guard exists; not needed).

---

## Task 1: Engine types + constants

**Files:**
- Create: `lib/quick-match-engine.ts` (initial export of types only)
- Create: `tests/lib/quick-match-engine.test.ts` (one trivial test that imports types)

- [ ] **Step 1: Create the types file**

Create `lib/quick-match-engine.ts` with EXACTLY:

```ts
export type QuickFormat = 'singles' | 'doubles';
export type Side = 'A' | 'B';

export interface QuickRules {
  pointsToWin: number;     // 1..99
  bestOf: 1 | 3;
  deuceEnabled: boolean;
}

export interface QuickGame {
  a: number;
  b: number;
  winner: Side | null;
}

export interface QuickMatch {
  format: QuickFormat;
  sideAName: string;
  sideBName: string;
  rules: QuickRules;
  completedGames: QuickGame[];
  currentGame: QuickGame;
  history: Side[];
  startedAt: number;
  matchWinner: Side | null;
}

export const CAP_OFFSET = 9; // CAP = pointsToWin + 9

export function gamesNeededToWinMatch(rules: QuickRules): number {
  return Math.ceil(rules.bestOf / 2);
}
```

- [ ] **Step 2: Write a smoke test for `gamesNeededToWinMatch`**

Create `tests/lib/quick-match-engine.test.ts`:

```ts
import { gamesNeededToWinMatch } from '@/lib/quick-match-engine';

describe('gamesNeededToWinMatch', () => {
  it('returns 1 for best-of-1', () => {
    expect(gamesNeededToWinMatch({ pointsToWin: 21, bestOf: 1, deuceEnabled: true })).toBe(1);
  });
  it('returns 2 for best-of-3', () => {
    expect(gamesNeededToWinMatch({ pointsToWin: 21, bestOf: 3, deuceEnabled: true })).toBe(2);
  });
});
```

- [ ] **Step 3: Run tests**

```bash
npm test -- quick-match-engine.test
```

Expected: 2/2 PASS.

- [ ] **Step 4: Commit**

```bash
git add lib/quick-match-engine.ts tests/lib/quick-match-engine.test.ts
git commit -m "feat(quick-match): add engine types + gamesNeededToWinMatch"
```

---

## Task 2: `createMatch`, `isGameOver`, `currentServer`

**Files:**
- Modify: `lib/quick-match-engine.ts`
- Modify: `tests/lib/quick-match-engine.test.ts`

- [ ] **Step 1: Write failing tests**

Append to `tests/lib/quick-match-engine.test.ts`:

```ts
import {
  createMatch,
  isGameOver,
  currentServer,
} from '@/lib/quick-match-engine';

const RULES_NO_DEUCE = { pointsToWin: 21, bestOf: 1, deuceEnabled: false } as const;
const RULES_DEUCE = { pointsToWin: 21, bestOf: 1, deuceEnabled: true } as const;
const RULES_BO3 = { pointsToWin: 21, bestOf: 3, deuceEnabled: true } as const;

describe('createMatch', () => {
  it('returns a match with empty completedGames and zeroed currentGame', () => {
    const m = createMatch({
      format: 'singles',
      sideAName: 'A',
      sideBName: 'B',
      rules: RULES_DEUCE,
    });
    expect(m.completedGames).toEqual([]);
    expect(m.currentGame).toEqual({ a: 0, b: 0, winner: null });
    expect(m.history).toEqual([]);
    expect(m.matchWinner).toBeNull();
    expect(m.format).toBe('singles');
    expect(m.sideAName).toBe('A');
    expect(m.sideBName).toBe('B');
    expect(m.rules).toEqual(RULES_DEUCE);
    expect(typeof m.startedAt).toBe('number');
  });
});

describe('isGameOver — no deuce', () => {
  it('returns null while no side has reached pointsToWin', () => {
    expect(isGameOver({ a: 20, b: 19, winner: null }, RULES_NO_DEUCE)).toBeNull();
  });
  it('returns A when A reaches pointsToWin first', () => {
    expect(isGameOver({ a: 21, b: 0, winner: null }, RULES_NO_DEUCE)).toBe('A');
  });
  it('returns B when B reaches pointsToWin first', () => {
    expect(isGameOver({ a: 19, b: 21, winner: null }, RULES_NO_DEUCE)).toBe('B');
  });
});

describe('isGameOver — deuce', () => {
  it('21-19 → A wins (lead by 2 at threshold)', () => {
    expect(isGameOver({ a: 21, b: 19, winner: null }, RULES_DEUCE)).toBe('A');
  });
  it('21-20 → null (lead by only 1)', () => {
    expect(isGameOver({ a: 21, b: 20, winner: null }, RULES_DEUCE)).toBeNull();
  });
  it('22-20 → A wins (lead by 2 above threshold)', () => {
    expect(isGameOver({ a: 22, b: 20, winner: null }, RULES_DEUCE)).toBe('A');
  });
  it('29-29 → null (no cap, no lead-by-2)', () => {
    expect(isGameOver({ a: 29, b: 29, winner: null }, RULES_DEUCE)).toBeNull();
  });
  it('30-29 → A wins via cap', () => {
    expect(isGameOver({ a: 30, b: 29, winner: null }, RULES_DEUCE)).toBe('A');
  });
  it('29-30 → B wins via cap', () => {
    expect(isGameOver({ a: 29, b: 30, winner: null }, RULES_DEUCE)).toBe('B');
  });
});

describe('currentServer', () => {
  it("returns 'A' on a 0-0 fresh match (default)", () => {
    const m = createMatch({ format: 'singles', sideAName: 'A', sideBName: 'B', rules: RULES_DEUCE });
    expect(currentServer(m)).toBe('A');
  });
  it("returns the side of the last point in history", () => {
    const m = createMatch({ format: 'singles', sideAName: 'A', sideBName: 'B', rules: RULES_DEUCE });
    const m2 = { ...m, currentGame: { a: 1, b: 0, winner: null }, history: ['A'] as ('A' | 'B')[] };
    expect(currentServer(m2)).toBe('A');
    const m3 = { ...m, currentGame: { a: 1, b: 1, winner: null }, history: ['A', 'B'] as ('A' | 'B')[] };
    expect(currentServer(m3)).toBe('B');
  });
});
```

- [ ] **Step 2: Run tests; expect failures (functions don't exist yet)**

```bash
npm test -- quick-match-engine.test
```

Expected: imports fail OR new tests FAIL.

- [ ] **Step 3: Implement the functions**

Append to `lib/quick-match-engine.ts`:

```ts
export function createMatch(input: {
  format: QuickFormat;
  sideAName: string;
  sideBName: string;
  rules: QuickRules;
}): QuickMatch {
  return {
    format: input.format,
    sideAName: input.sideAName,
    sideBName: input.sideBName,
    rules: input.rules,
    completedGames: [],
    currentGame: { a: 0, b: 0, winner: null },
    history: [],
    startedAt: Date.now(),
    matchWinner: null,
  };
}

export function isGameOver(game: QuickGame, rules: QuickRules): Side | null {
  const { a, b } = game;
  const T = rules.pointsToWin;
  const CAP = T + CAP_OFFSET;

  if (rules.deuceEnabled) {
    if (a >= CAP) return 'A';
    if (b >= CAP) return 'B';
    if (a >= T && a - b >= 2) return 'A';
    if (b >= T && b - a >= 2) return 'B';
    return null;
  }
  // No deuce: first to T wins.
  if (a >= T && a > b) return 'A';
  if (b >= T && b > a) return 'B';
  return null;
}

export function currentServer(match: QuickMatch): Side {
  if (match.history.length === 0) return 'A';
  return match.history[match.history.length - 1];
}
```

- [ ] **Step 4: Run tests**

```bash
npm test -- quick-match-engine.test
```

Expected: all engine tests PASS (no-deuce cases, deuce cases, currentServer cases).

- [ ] **Step 5: Commit**

```bash
git add lib/quick-match-engine.ts tests/lib/quick-match-engine.test.ts
git commit -m "feat(quick-match): add createMatch, isGameOver, currentServer with tests"
```

---

## Task 3: `applyPoint` and `isMatchOver`

**Files:**
- Modify: `lib/quick-match-engine.ts`
- Modify: `tests/lib/quick-match-engine.test.ts`

- [ ] **Step 1: Write failing tests**

Append to `tests/lib/quick-match-engine.test.ts`:

```ts
import { applyPoint, isMatchOver } from '@/lib/quick-match-engine';

function applyMany(match: ReturnType<typeof createMatch>, sequence: ('A' | 'B')[]) {
  return sequence.reduce((m, s) => applyPoint(m, s), match);
}

describe('applyPoint — single side increments', () => {
  it('increments side A and pushes history', () => {
    const m = createMatch({ format: 'singles', sideAName: 'A', sideBName: 'B', rules: RULES_DEUCE });
    const m2 = applyPoint(m, 'A');
    expect(m2.currentGame).toEqual({ a: 1, b: 0, winner: null });
    expect(m2.history).toEqual(['A']);
  });
});

describe('applyPoint — completes a game (no deuce, bestOf=1)', () => {
  it('A wins game 1 → match over with matchWinner A', () => {
    const m = createMatch({ format: 'singles', sideAName: 'A', sideBName: 'B', rules: RULES_NO_DEUCE });
    const seq: ('A' | 'B')[] = Array(21).fill('A');
    const m2 = applyMany(m, seq);
    expect(m2.completedGames).toHaveLength(1);
    expect(m2.completedGames[0].winner).toBe('A');
    expect(m2.completedGames[0]).toEqual({ a: 21, b: 0, winner: 'A' });
    expect(m2.currentGame).toEqual({ a: 0, b: 0, winner: null });
    expect(m2.history).toEqual([]);
    expect(m2.matchWinner).toBe('A');
  });
});

describe('applyPoint — completes a game (deuce extension)', () => {
  it('22-20 closes the game', () => {
    const m = createMatch({ format: 'singles', sideAName: 'A', sideBName: 'B', rules: RULES_DEUCE });
    // Reach 20-20 then A wins next two
    const seq: ('A' | 'B')[] = [];
    for (let i = 0; i < 20; i++) { seq.push('A'); seq.push('B'); }
    seq.push('A'); // 21-20
    seq.push('A'); // 22-20 → A wins
    const m2 = applyMany(m, seq);
    expect(m2.completedGames).toHaveLength(1);
    expect(m2.completedGames[0]).toEqual({ a: 22, b: 20, winner: 'A' });
    expect(m2.matchWinner).toBe('A');
  });

  it('cap at 30 fires from 29-29 → next point wins', () => {
    const m = createMatch({ format: 'singles', sideAName: 'A', sideBName: 'B', rules: RULES_DEUCE });
    // Reach 29-29 (deuce game continuing)
    const seq: ('A' | 'B')[] = [];
    for (let i = 0; i < 29; i++) { seq.push('A'); seq.push('B'); }
    seq.push('B'); // 29-30 → B wins via cap
    const m2 = applyMany(m, seq);
    expect(m2.completedGames[0]).toEqual({ a: 29, b: 30, winner: 'B' });
    expect(m2.matchWinner).toBe('B');
  });
});

describe('applyPoint — bestOf=3 progression', () => {
  it('A wins game 1 and game 2 → match over after 2 games', () => {
    const m = createMatch({ format: 'singles', sideAName: 'A', sideBName: 'B', rules: RULES_BO3 });
    // Game 1: A 21-0
    let m2 = applyMany(m, Array(21).fill('A'));
    expect(m2.matchWinner).toBeNull();
    expect(m2.completedGames).toHaveLength(1);
    // Game 2: A 21-0
    m2 = applyMany(m2, Array(21).fill('A'));
    expect(m2.matchWinner).toBe('A');
    expect(m2.completedGames).toHaveLength(2);
  });

  it('1-1 in games then A wins game 3 → match over', () => {
    const m = createMatch({ format: 'singles', sideAName: 'A', sideBName: 'B', rules: RULES_BO3 });
    let m2 = applyMany(m, Array(21).fill('A'));      // game 1 A
    m2 = applyMany(m2, Array(21).fill('B'));         // game 2 B
    expect(m2.matchWinner).toBeNull();
    m2 = applyMany(m2, Array(21).fill('A'));         // game 3 A
    expect(m2.matchWinner).toBe('A');
    expect(m2.completedGames).toHaveLength(3);
  });
});

describe('applyPoint — no-op after match over', () => {
  it('does not modify match once matchWinner is set', () => {
    const m = createMatch({ format: 'singles', sideAName: 'A', sideBName: 'B', rules: RULES_NO_DEUCE });
    let m2 = applyMany(m, Array(21).fill('A'));
    expect(m2.matchWinner).toBe('A');
    const m3 = applyPoint(m2, 'B');
    expect(m3).toBe(m2); // identity — no-op
  });
});

describe('isMatchOver', () => {
  it('returns null until a side has won enough games', () => {
    const m = createMatch({ format: 'singles', sideAName: 'A', sideBName: 'B', rules: RULES_BO3 });
    expect(isMatchOver(m)).toBeNull();
  });
  it('returns the side that has won enough games', () => {
    const m = createMatch({ format: 'singles', sideAName: 'A', sideBName: 'B', rules: RULES_BO3 });
    const m2 = { ...m, completedGames: [
      { a: 21, b: 0, winner: 'A' as const },
      { a: 21, b: 0, winner: 'A' as const },
    ] };
    expect(isMatchOver(m2)).toBe('A');
  });
});
```

- [ ] **Step 2: Run tests; expect failures**

```bash
npm test -- quick-match-engine.test
```

Expected: new tests FAIL — `applyPoint` / `isMatchOver` not defined.

- [ ] **Step 3: Implement the functions**

Append to `lib/quick-match-engine.ts`:

```ts
export function isMatchOver(match: QuickMatch): Side | null {
  const need = gamesNeededToWinMatch(match.rules);
  const aWins = match.completedGames.filter((g) => g.winner === 'A').length;
  const bWins = match.completedGames.filter((g) => g.winner === 'B').length;
  if (aWins >= need) return 'A';
  if (bWins >= need) return 'B';
  return null;
}

export function applyPoint(match: QuickMatch, side: Side): QuickMatch {
  if (match.matchWinner) return match;

  const nextGame: QuickGame = {
    a: match.currentGame.a + (side === 'A' ? 1 : 0),
    b: match.currentGame.b + (side === 'B' ? 1 : 0),
    winner: null,
  };
  const winner = isGameOver(nextGame, match.rules);

  if (!winner) {
    return {
      ...match,
      currentGame: nextGame,
      history: [...match.history, side],
    };
  }

  // Game complete — push to completedGames, reset current, clear history.
  const finalGame: QuickGame = { ...nextGame, winner };
  const completedGames = [...match.completedGames, finalGame];
  const aWins = completedGames.filter((g) => g.winner === 'A').length;
  const bWins = completedGames.filter((g) => g.winner === 'B').length;
  const need = gamesNeededToWinMatch(match.rules);
  const matchWinner: Side | null =
    aWins >= need ? 'A' : bWins >= need ? 'B' : null;

  return {
    ...match,
    completedGames,
    currentGame: { a: 0, b: 0, winner: null },
    history: [],
    matchWinner,
  };
}
```

- [ ] **Step 4: Run tests**

```bash
npm test -- quick-match-engine.test
```

Expected: all engine tests PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/quick-match-engine.ts tests/lib/quick-match-engine.test.ts
git commit -m "feat(quick-match): add applyPoint + isMatchOver with tests for deuce, cap, and bestOf=3"
```

---

## Task 4: `undoLastPoint`

**Files:**
- Modify: `lib/quick-match-engine.ts`
- Modify: `tests/lib/quick-match-engine.test.ts`

- [ ] **Step 1: Write failing tests**

Append to `tests/lib/quick-match-engine.test.ts`:

```ts
import { undoLastPoint } from '@/lib/quick-match-engine';

describe('undoLastPoint', () => {
  it('decrements the last side scored and pops history', () => {
    const m = createMatch({ format: 'singles', sideAName: 'A', sideBName: 'B', rules: RULES_DEUCE });
    let m2 = applyPoint(m, 'A');
    m2 = applyPoint(m2, 'A');
    m2 = applyPoint(m2, 'B');
    // 2-1, history = [A,A,B]
    const m3 = undoLastPoint(m2);
    expect(m3.currentGame).toEqual({ a: 2, b: 0, winner: null });
    expect(m3.history).toEqual(['A', 'A']);
  });

  it('is a no-op when history is empty', () => {
    const m = createMatch({ format: 'singles', sideAName: 'A', sideBName: 'B', rules: RULES_DEUCE });
    const m2 = undoLastPoint(m);
    expect(m2).toBe(m);
  });

  it('does NOT cross game boundaries (after a game ends, history is empty)', () => {
    const m = createMatch({ format: 'singles', sideAName: 'A', sideBName: 'B', rules: RULES_BO3 });
    // Win game 1 by A 21-0
    let m2 = m;
    for (let i = 0; i < 21; i++) m2 = applyPoint(m2, 'A');
    expect(m2.completedGames).toHaveLength(1);
    expect(m2.history).toEqual([]);
    const m3 = undoLastPoint(m2);
    expect(m3).toBe(m2); // no-op — history is empty
    expect(m3.completedGames).toHaveLength(1); // game 1 still recorded
  });
});
```

- [ ] **Step 2: Run tests; expect failures**

```bash
npm test -- quick-match-engine.test
```

Expected: new tests FAIL — `undoLastPoint` not defined.

- [ ] **Step 3: Implement**

Append to `lib/quick-match-engine.ts`:

```ts
export function undoLastPoint(match: QuickMatch): QuickMatch {
  if (match.history.length === 0) return match;
  const last = match.history[match.history.length - 1];
  return {
    ...match,
    currentGame: {
      a: match.currentGame.a - (last === 'A' ? 1 : 0),
      b: match.currentGame.b - (last === 'B' ? 1 : 0),
      winner: null,
    },
    history: match.history.slice(0, -1),
  };
}
```

- [ ] **Step 4: Run tests**

```bash
npm test -- quick-match-engine.test
```

Expected: all engine tests PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/quick-match-engine.ts tests/lib/quick-match-engine.test.ts
git commit -m "feat(quick-match): add undoLastPoint with tests confirming no cross-game undo"
```

---

## Task 5: Zustand store

**Files:**
- Create: `store/quick-match.store.ts`

- [ ] **Step 1: Write the store**

Create `store/quick-match.store.ts` with EXACTLY:

```ts
import { create } from 'zustand';

import {
  applyPoint,
  createMatch,
  undoLastPoint,
  type QuickFormat,
  type QuickMatch,
  type QuickRules,
  type Side,
} from '@/lib/quick-match-engine';

interface QuickMatchState {
  match: QuickMatch | null;
  startMatch: (input: {
    format: QuickFormat;
    sideAName: string;
    sideBName: string;
    rules: QuickRules;
  }) => void;
  scorePoint: (side: Side) => void;
  undo: () => void;
  rematch: () => void;
  reset: () => void;
}

export const useQuickMatchStore = create<QuickMatchState>((set, get) => ({
  match: null,
  startMatch: (input) => set({ match: createMatch(input) }),
  scorePoint: (side) => {
    const cur = get().match;
    if (!cur) return;
    set({ match: applyPoint(cur, side) });
  },
  undo: () => {
    const cur = get().match;
    if (!cur) return;
    set({ match: undoLastPoint(cur) });
  },
  rematch: () => {
    const cur = get().match;
    if (!cur) return;
    set({
      match: createMatch({
        format: cur.format,
        sideAName: cur.sideAName,
        sideBName: cur.sideBName,
        rules: cur.rules,
      }),
    });
  },
  reset: () => set({ match: null }),
}));
```

- [ ] **Step 2: Verify type-check**

```bash
npx tsc --noEmit
```

Expected: no new errors from this file.

- [ ] **Step 3: Commit**

```bash
git add store/quick-match.store.ts
git commit -m "feat(quick-match): add Zustand store wrapping the engine"
```

---

## Task 6: `QuickMatchButton` component

**Files:**
- Create: `components/quick/QuickMatchButton.tsx`

- [ ] **Step 1: Write the component**

Create `components/quick/QuickMatchButton.tsx` with EXACTLY:

```tsx
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

interface Props {
  style?: object;
}

export function QuickMatchButton({ style }: Props) {
  return (
    <Pressable
      onPress={() => router.push('/quick')}
      style={({ pressed }) => [styles.button, pressed && styles.pressed, style]}
      accessibilityRole="button"
      accessibilityLabel="Start a Quick Match — no login required"
    >
      <View style={styles.iconWrap}>
        <Text style={styles.icon}>⚡</Text>
      </View>
      <View style={styles.textWrap}>
        <Text style={styles.label}>Quick Match</Text>
        <Text style={styles.sublabel}>No login required</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F172A',
    borderColor: '#3B82F6',
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 18,
    gap: 14,
  },
  pressed: { opacity: 0.85 },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: { fontSize: 18 },
  textWrap: { flex: 1 },
  label: { color: '#F8FAFC', fontSize: 15, fontWeight: '700' },
  sublabel: { color: '#94A3B8', fontSize: 12, marginTop: 2 },
});
```

- [ ] **Step 2: Verify type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/quick/QuickMatchButton.tsx
git commit -m "feat(quick-match): add QuickMatchButton CTA component"
```

---

## Task 7: Quick Match route layout + setup screen

**Files:**
- Create: `app/quick/_layout.tsx`
- Create: `app/quick/index.tsx`

- [ ] **Step 1: Create the layout**

Create `app/quick/_layout.tsx`:

```tsx
import { Stack } from 'expo-router';

export default function QuickMatchLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
```

- [ ] **Step 2: Create the setup screen**

Create `app/quick/index.tsx` with EXACTLY:

```tsx
import { router } from 'expo-router';
import { useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useQuickMatchStore } from '@/store/quick-match.store';
import type { QuickFormat } from '@/lib/quick-match-engine';

export default function QuickMatchSetup() {
  const startMatch = useQuickMatchStore((s) => s.startMatch);

  const [format, setFormat] = useState<QuickFormat>('singles');
  const [sideAName, setSideAName] = useState('');
  const [sideBName, setSideBName] = useState('');
  const [pointsToWin, setPointsToWin] = useState(21);
  const [bestOf, setBestOf] = useState<1 | 3>(1);
  const [deuceEnabled, setDeuceEnabled] = useState(true);
  const [pointsError, setPointsError] = useState<string | null>(null);

  const validate = (): boolean => {
    if (!Number.isInteger(pointsToWin) || pointsToWin < 1 || pointsToWin > 99) {
      setPointsError('Points must be a whole number between 1 and 99.');
      return false;
    }
    setPointsError(null);
    return true;
  };

  const handleStart = () => {
    if (!validate()) return;
    startMatch({
      format,
      sideAName: sideAName.trim() || 'Side A',
      sideBName: sideBName.trim() || 'Side B',
      rules: { pointsToWin, bestOf, deuceEnabled },
    });
    router.push('/quick/play');
  };

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
      <Text style={styles.title}>Quick Match</Text>
      <Text style={styles.subtitle}>No login. No tournament. Just score a game.</Text>

      <View style={styles.card}>
        <Text style={styles.section}>Format</Text>
        <View style={styles.row}>
          <Pressable
            onPress={() => setFormat('singles')}
            style={[styles.chip, format === 'singles' && styles.chipActive]}
          >
            <Text style={[styles.chipText, format === 'singles' && styles.chipTextActive]}>Singles</Text>
          </Pressable>
          <Pressable
            onPress={() => setFormat('doubles')}
            style={[styles.chip, format === 'doubles' && styles.chipActive]}
          >
            <Text style={[styles.chipText, format === 'doubles' && styles.chipTextActive]}>Doubles</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.section}>Sides</Text>
        <Text style={styles.label}>Side A</Text>
        <TextInput
          value={sideAName}
          onChangeText={setSideAName}
          placeholder="Side A"
          placeholderTextColor="#475569"
          maxLength={40}
          style={styles.input}
        />
        <Text style={[styles.label, { marginTop: 12 }]}>Side B</Text>
        <TextInput
          value={sideBName}
          onChangeText={setSideBName}
          placeholder="Side B"
          placeholderTextColor="#475569"
          maxLength={40}
          style={styles.input}
        />
      </View>

      <View style={styles.card}>
        <Text style={styles.section}>Scoring</Text>
        <Text style={styles.label}>Points to win</Text>
        <View style={styles.stepperRow}>
          <Pressable
            onPress={() => setPointsToWin((p) => Math.max(1, p - 1))}
            style={styles.stepperBtn}
          >
            <Text style={styles.stepperLabel}>−</Text>
          </Pressable>
          <TextInput
            value={String(pointsToWin)}
            onChangeText={(v) => {
              const n = parseInt(v, 10);
              setPointsToWin(Number.isNaN(n) ? 0 : n);
              setPointsError(null);
            }}
            keyboardType="numeric"
            style={styles.stepperInput}
          />
          <Pressable
            onPress={() => setPointsToWin((p) => Math.min(99, p + 1))}
            style={styles.stepperBtn}
          >
            <Text style={styles.stepperLabel}>+</Text>
          </Pressable>
        </View>
        {pointsError && <Text style={styles.error}>{pointsError}</Text>}

        <Text style={[styles.label, { marginTop: 16 }]}>Best of</Text>
        <View style={styles.row}>
          <Pressable
            onPress={() => setBestOf(1)}
            style={[styles.chip, bestOf === 1 && styles.chipActive]}
          >
            <Text style={[styles.chipText, bestOf === 1 && styles.chipTextActive]}>1</Text>
          </Pressable>
          <Pressable
            onPress={() => setBestOf(3)}
            style={[styles.chip, bestOf === 3 && styles.chipActive]}
          >
            <Text style={[styles.chipText, bestOf === 3 && styles.chipTextActive]}>3</Text>
          </Pressable>
        </View>

        <View style={styles.deuceRow}>
          <Text style={styles.label}>Deuce (win by 2, capped at +9)</Text>
          <Switch value={deuceEnabled} onValueChange={setDeuceEnabled} />
        </View>
      </View>

      <Pressable onPress={handleStart} style={styles.startBtn}>
        <Text style={styles.startBtnText}>Start match →</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: '#0B1120' },
  container: { padding: 24, gap: 16, maxWidth: 560, width: '100%', alignSelf: 'center' },
  title: { color: '#F8FAFC', fontSize: 32, fontWeight: '700' },
  subtitle: { color: '#94A3B8', fontSize: 14, marginBottom: 8 },
  card: { backgroundColor: '#0F172A', padding: 16, borderRadius: 12, gap: 8 },
  section: { color: '#F8FAFC', fontSize: 16, fontWeight: '700', marginBottom: 4 },
  label: { color: '#CBD5E1', fontSize: 13, fontWeight: '600' },
  row: { flexDirection: 'row', gap: 8 },
  chip: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  chipActive: { borderColor: '#3B82F6', backgroundColor: '#1E3A8A' },
  chipText: { color: '#94A3B8', fontSize: 14, fontWeight: '600' },
  chipTextActive: { color: '#FFFFFF' },
  input: {
    backgroundColor: '#1E293B',
    color: '#F8FAFC',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    fontSize: 15,
  },
  stepperRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  stepperBtn: {
    width: 44,
    height: 44,
    backgroundColor: '#1E293B',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperLabel: { color: '#F8FAFC', fontSize: 22, fontWeight: '700' },
  stepperInput: {
    flex: 1,
    backgroundColor: '#1E293B',
    color: '#F8FAFC',
    height: 44,
    borderRadius: 8,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '700',
  },
  deuceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  error: { color: '#F87171', fontSize: 12, marginTop: 4 },
  startBtn: {
    backgroundColor: '#3B82F6',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  startBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
});
```

- [ ] **Step 3: Verify type-check**

```bash
npx tsc --noEmit
```

Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add app/quick/_layout.tsx app/quick/index.tsx
git commit -m "feat(quick-match): add /quick setup screen"
```

---

## Task 8: Scoring + Complete screen

**Files:**
- Create: `app/quick/play.tsx`

- [ ] **Step 1: Write the screen**

Create `app/quick/play.tsx` with EXACTLY:

```tsx
import { router } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  currentServer,
  gamesNeededToWinMatch,
  type Side,
} from '@/lib/quick-match-engine';
import { useQuickMatchStore } from '@/store/quick-match.store';

export default function QuickMatchPlay() {
  const match = useQuickMatchStore((s) => s.match);
  const scorePoint = useQuickMatchStore((s) => s.scorePoint);
  const undo = useQuickMatchStore((s) => s.undo);
  const rematch = useQuickMatchStore((s) => s.rematch);
  const reset = useQuickMatchStore((s) => s.reset);

  // Refresh recovery: if there's no match in store, send back to setup.
  useEffect(() => {
    if (!match) router.replace('/quick');
  }, [match]);

  if (!match) return null;

  const isOver = match.matchWinner !== null;
  const winnerSide: Side | null = match.matchWinner;
  const winnerName =
    winnerSide === 'A' ? match.sideAName : winnerSide === 'B' ? match.sideBName : null;
  const aGameWins = match.completedGames.filter((g) => g.winner === 'A').length;
  const bGameWins = match.completedGames.filter((g) => g.winner === 'B').length;
  const need = gamesNeededToWinMatch(match.rules);
  const server = currentServer(match);

  const formatLabel = match.format === 'doubles' ? 'Doubles' : 'Singles';
  const rulesLabel = `${match.rules.pointsToWin} pts · Best of ${match.rules.bestOf}${match.rules.deuceEnabled ? ' · Deuce' : ''}`;

  return (
    <View style={styles.root}>
      <View style={styles.topbar}>
        <Pressable onPress={() => { reset(); router.replace('/quick'); }}>
          <Text style={styles.topbarLink}>‹ Exit</Text>
        </Pressable>
        <Text style={styles.topbarMeta}>{formatLabel} · {rulesLabel}</Text>
        <View style={{ width: 50 }} />
      </View>

      {isOver ? (
        <View style={styles.completeWrap}>
          <Text style={styles.trophy}>🏆</Text>
          <Text style={styles.completeTitle}>{winnerName} wins!</Text>
          <Text style={styles.completeSub}>
            Best of {match.rules.bestOf} — {aGameWins}-{bGameWins}
          </Text>
          <View style={styles.scoreSummary}>
            {match.completedGames.map((g, i) => (
              <Text key={i} style={styles.scoreLine}>
                Game {i + 1}: {g.a}–{g.b}
              </Text>
            ))}
          </View>
          <View style={styles.completeButtons}>
            <Pressable style={[styles.btn, styles.btnPrimary]} onPress={rematch}>
              <Text style={styles.btnPrimaryText}>Rematch</Text>
            </Pressable>
            <Pressable
              style={[styles.btn, styles.btnSecondary]}
              onPress={() => { reset(); router.replace('/quick'); }}
            >
              <Text style={styles.btnSecondaryText}>New match</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <>
          <View style={styles.scoreRow}>
            <Pressable
              style={[styles.side, styles.sideA, server === 'A' && styles.sideServing]}
              onPress={() => scorePoint('A')}
            >
              <Text style={styles.sideName}>{match.sideAName}</Text>
              <Text style={styles.sideScore}>{match.currentGame.a}</Text>
              <Text style={styles.sideHint}>Tap to add point</Text>
              <Text style={styles.gamesWon}>{aGameWins} / {need}</Text>
            </Pressable>
            <Pressable
              style={[styles.side, styles.sideB, server === 'B' && styles.sideServing]}
              onPress={() => scorePoint('B')}
            >
              <Text style={styles.sideName}>{match.sideBName}</Text>
              <Text style={styles.sideScore}>{match.currentGame.b}</Text>
              <Text style={styles.sideHint}>Tap to add point</Text>
              <Text style={styles.gamesWon}>{bGameWins} / {need}</Text>
            </Pressable>
          </View>

          <View style={styles.bottomBar}>
            <Pressable
              onPress={undo}
              disabled={match.history.length === 0}
              style={[styles.undoBtn, match.history.length === 0 && styles.undoBtnDim]}
            >
              <Text style={styles.undoBtnText}>↶ Undo</Text>
            </Pressable>
            <View style={styles.completedGamesWrap}>
              {match.completedGames.length > 0 && (
                <Text style={styles.completedGamesText}>
                  {match.completedGames.map((g, i) => `${g.a}–${g.b}`).join('  ·  ')}
                </Text>
              )}
            </View>
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0B1120' },
  topbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: 28,
  },
  topbarLink: { color: '#3B82F6', fontSize: 15, fontWeight: '600', width: 50 },
  topbarMeta: { color: '#94A3B8', fontSize: 12 },
  scoreRow: { flex: 1, flexDirection: 'row' },
  side: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    gap: 12,
  },
  sideA: { backgroundColor: '#0F172A' },
  sideB: { backgroundColor: '#172033' },
  sideServing: { borderTopWidth: 4, borderTopColor: '#3B82F6' },
  sideName: { color: '#94A3B8', fontSize: 18, fontWeight: '600', textAlign: 'center' },
  sideScore: { color: '#F8FAFC', fontSize: 144, fontWeight: '900' },
  sideHint: { color: '#475569', fontSize: 13 },
  gamesWon: { color: '#64748B', fontSize: 13, marginTop: 8 },
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  undoBtn: { backgroundColor: '#1E293B', paddingVertical: 10, paddingHorizontal: 18, borderRadius: 8 },
  undoBtnDim: { opacity: 0.4 },
  undoBtnText: { color: '#F8FAFC', fontSize: 14, fontWeight: '600' },
  completedGamesWrap: { flex: 1 },
  completedGamesText: { color: '#94A3B8', fontSize: 13, textAlign: 'right' },
  completeWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 8 },
  trophy: { fontSize: 64 },
  completeTitle: { color: '#F8FAFC', fontSize: 32, fontWeight: '800', textAlign: 'center' },
  completeSub: { color: '#94A3B8', fontSize: 16 },
  scoreSummary: { marginTop: 16, gap: 4 },
  scoreLine: { color: '#CBD5E1', fontSize: 15, textAlign: 'center' },
  completeButtons: { flexDirection: 'row', gap: 12, marginTop: 24 },
  btn: { paddingVertical: 14, paddingHorizontal: 24, borderRadius: 10 },
  btnPrimary: { backgroundColor: '#3B82F6' },
  btnPrimaryText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  btnSecondary: { backgroundColor: '#1E293B' },
  btnSecondaryText: { color: '#F8FAFC', fontSize: 15, fontWeight: '600' },
});
```

- [ ] **Step 2: Verify type-check**

```bash
npx tsc --noEmit
```

Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add app/quick/play.tsx
git commit -m "feat(quick-match): add /quick/play scoring + complete screen"
```

---

## Task 9: Wire `QuickMatchButton` into `/login` and `/dashboard`

**Files:**
- Modify: `app/(auth)/login.tsx`
- Modify: `app/(organizer)/dashboard.tsx`

- [ ] **Step 1: Add to login screen**

Read `app/(auth)/login.tsx` to find a sensible spot — after the existing form fields and submit button, before the "Create one" register link.

Add this import near the other component imports at top:

```tsx
import { QuickMatchButton } from '@/components/quick/QuickMatchButton';
```

Find the JSX block that renders the form (look for the "Sign In" button). Immediately AFTER the form's outer container View (the one wrapping the email/password/submit), and BEFORE the "Need an account? Create one" link, add:

```tsx
<View style={{ marginTop: 16 }}>
  <QuickMatchButton />
</View>
```

If a similar wrapper style already exists (e.g. another full-width section), match its margin pattern instead of inlining `marginTop: 16`.

- [ ] **Step 2: Add to dashboard**

Read `app/(organizer)/dashboard.tsx` and find where the "+ Create Tournament" button lives in the header area. The QuickMatchButton should sit either above or beside it.

Add the same import near the top:

```tsx
import { QuickMatchButton } from '@/components/quick/QuickMatchButton';
```

In the JSX, ABOVE the section that contains "Total Tournaments" / "Active Now" stat cards (or right under the page title block), add:

```tsx
<View style={{ marginBottom: 24 }}>
  <QuickMatchButton />
</View>
```

Match the file's existing wrapper conventions if you see a layout pattern like a card section.

- [ ] **Step 3: Verify type-check**

```bash
npx tsc --noEmit
```

Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add "app/(auth)/login.tsx" "app/(organizer)/dashboard.tsx"
git commit -m "feat(quick-match): mount QuickMatchButton on /login and /dashboard"
```

---

## Task 10: Final verification

- [ ] **Step 1: Type-check + tests**

```bash
npx tsc --noEmit && npm test
```

Expected: zero TS errors. All Jest tests pass (engine tests + any prior tests in the repo).

- [ ] **Step 2: Manual web smoke**

```bash
npm run web
```

Manually verify each:
- [ ] `/login` shows the new "Quick Match — No login required" CTA. Tapping it opens `/quick`.
- [ ] Can sign in to `/dashboard` and see the same CTA there.
- [ ] On `/quick`, defaults render: Singles selected, points = 21, best-of-1, deuce on. Side A and Side B inputs accept text.
- [ ] Tap **Start match** → `/quick/play` renders with 0–0 and both sides tappable.
- [ ] Tap Side A 21 times → match ends, Complete screen with "Side A wins! · 1–0".
- [ ] Tap **Rematch** → fresh 0–0; same names/rules.
- [ ] Tap **New match** → back to `/quick` setup.
- [ ] Refresh `/quick/play` directly with no in-progress match → redirects to `/quick`.
- [ ] Test deuce: set points=5, deuce on. Score 4–4, then alternate. 5–4 should NOT win; 6–4 should.
- [ ] Test cap: set points=2, deuce on. CAP=11. Take both to 10–10; next point on either side wins.
- [ ] Test best-of-3: pick best-of-3 in setup; first side to win 2 games wins the match.
- [ ] Test undo: score 3 points for A, undo → 2-0. Undo while at 0-0 should be a no-op (button is dimmed).
- [ ] No new console errors during any of the above.

- [ ] **Step 3: Final commit if smoke surfaces tweaks**

```bash
git add -u
git commit -m "chore(quick-match): smoke-test polish"
```

(Skip if no changes needed.)

- [ ] **Step 4: Push**

```bash
git push -u origin vignesh/quick-match
```

Then open a PR on GitHub at the URL printed by the push.

---

## Self-Review Notes

**Spec coverage check:**

| Spec section | Tasks |
|---|---|
| Goal: anyone, no account | Tasks 7 + 9 (route open, button wired) |
| Goal: singles or doubles | Task 7 (format chip in setup) |
| Goal: user-set points + best-of + deuce | Tasks 1–4 (engine), Task 7 (form) |
| Goal: visible CTAs | Tasks 6 + 9 |
| Goal: no regressions | Final verification (Task 10 smoke) |
| Local-only state | Task 5 (Zustand, no persist) |
| Engine API: createMatch, applyPoint, undoLastPoint, isGameOver, isMatchOver, gamesNeededToWinMatch, currentServer | Tasks 1–4 |
| Setup form fields + validation | Task 7 |
| Scoring + Complete UI | Task 8 |
| Edge cases (refresh, post-match no-op, empty names, deuce cap) | Tasks 3, 7, 8, 10 |
| Tests: createMatch, isGameOver no-deuce, isGameOver deuce + cap, applyPoint completes game, bestOf=3, undo no cross-game | Tasks 2, 3, 4 |

No gaps detected. The spec's "modify auth-redirect guard" is intentionally absent (see Discovery note at top — there is no global guard).

**Placeholder scan:** None of the patterns from the no-placeholders list are present. Every step has runnable code or exact commands.

**Type consistency:** `QuickFormat`, `Side`, `QuickRules`, `QuickGame`, `QuickMatch`, `CAP_OFFSET`, `gamesNeededToWinMatch`, `createMatch`, `isGameOver`, `currentServer`, `applyPoint`, `isMatchOver`, `undoLastPoint` — all consistent across all tasks. Store function names (`startMatch`, `scorePoint`, `undo`, `rematch`, `reset`) consistent between Task 5 and Task 8.
