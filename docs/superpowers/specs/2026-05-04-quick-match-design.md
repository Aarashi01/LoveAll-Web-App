# Quick Match — Design

**Date:** 2026-05-04
**Author:** Vignesh + Claude
**Status:** Approved, ready for implementation plan

---

## Problem

The app today requires the full organizer flow — sign in, create a tournament, add players, generate brackets — before anyone can score a single match. That is overkill for casual use cases:

- Two friends warming up on a court who just want a digital scoreboard
- A coach demonstrating how the app works to a new club
- A test of the UI without polluting tournament data

There is no path through the app that lets a passerby with no account score a one-off match.

## Goals

1. **Anyone, no account** — anonymous users land on `/quick`, configure a match, and start scoring within five seconds.
2. **Singles or doubles** — both formats supported with the same UI.
3. **User-set points-to-win** — the explicit user ask. Plus best-of (1 or 3) and a deuce toggle so real games are playable.
4. **Refresh-safe is not required** — local-only is acceptable for v1.
5. **Visible entry points** — a prominent button on `/login` and on `/dashboard` so existing users discover it.
6. **No regressions** — the existing tournament/auth/scorekeeper flows continue to work unchanged.

## Non-goals

- Persistence — no Firestore writes, no spectator-shareable URL. Refresh = match lost. (A "save & share" follow-up is clean to add later because the local engine produces a final result that can be snapshotted.)
- Service-court tracking (left/right) and side-swap rules.
- Walkovers / forfeits / withdrawals.
- Per-game point history export, charts, statistics.
- Editing rules mid-match.
- Per-player fields for doubles. Side names are freeform; users type "Sandesh & Vignesh" as one string.
- Authentication on `/quick`. The route is exempt from the auth guard.

## Decisions locked in (from brainstorming)

1. **Local-only** state. No Firestore. No auth. No firestore.rules changes.
2. **Scoring config**: points-to-win + best-of (1 or 3) + deuce toggle. Deuce uses BWF rules: win-by-2 from `pointsToWin - 2` onward, hard-cap at `pointsToWin + 9` (whoever reaches the cap wins regardless of margin).
3. **Side-only names**. Singles vs Doubles is a cosmetic label; nothing under the hood differs.
4. **Entry**: prominent CTA on `/login` and on `/dashboard`. New top-level route `/quick`, exempt from the auth-redirect guard.

## Approach

A small, self-contained feature that adds:

1. A pure scoring engine in `lib/quick-match-engine.ts` — functions only, no state, fully unit-testable.
2. A Zustand store in `store/quick-match.store.ts` holding the in-progress match.
3. Two screens: `/quick` (setup form) and `/quick/play` (scoring + complete states).
4. A reusable `QuickMatchButton` mounted on `/login` and `/dashboard`.

The engine is the source of truth for game/match status; the UI just calls into it.

## Routes & files

### New

| Path | Purpose |
|---|---|
| `app/quick/_layout.tsx` | Bare Stack layout, no auth guard |
| `app/quick/index.tsx` | Setup screen — form → starts match → navigates to `/quick/play` |
| `app/quick/play.tsx` | Scoring screen + Complete state (same screen, switches by match status) |
| `lib/quick-match-engine.ts` | Pure scoring engine (see API below) |
| `store/quick-match.store.ts` | Zustand slice holding `QuickMatch` |
| `components/quick/QuickMatchButton.tsx` | Reusable CTA: "Quick Match — no login required" |
| `tests/lib/quick-match-engine.test.ts` | Jest tests for the engine |

### Modified

| Path | Change |
|---|---|
| `app/(auth)/login.tsx` | Add `<QuickMatchButton />` below the existing form |
| `app/(organizer)/dashboard.tsx` | Add `<QuickMatchButton />` near the top |
| `app/_layout.tsx` (or wherever auth-redirect lives) | `/quick/*` exempt from "redirect to /login" |

## Data model (in-memory only)

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
  sideAName: string;       // freeform; defaults to 'Side A'
  sideBName: string;
  rules: QuickRules;
  completedGames: QuickGame[];   // appended on each game's end
  currentGame: QuickGame;        // mutable until the game ends
  history: Side[];               // for undo within currentGame only
  startedAt: number;             // Date.now() at match start
  matchWinner: Side | null;      // set when isMatchOver returns a side
}
```

## Engine API (pure functions)

`lib/quick-match-engine.ts` exports:

```ts
function createMatch(input: {
  format: QuickFormat;
  sideAName: string;
  sideBName: string;
  rules: QuickRules;
}): QuickMatch;

function applyPoint(match: QuickMatch, side: Side): QuickMatch;
// Adds 1 to that side. If this point ends the current game, sets winner,
// pushes to completedGames, resets currentGame, clears history. If this
// point ends the match, sets matchWinner.

function undoLastPoint(match: QuickMatch): QuickMatch;
// Pops history; decrements the appropriate side. No-op if history empty.
// Cross-game undo is intentionally not supported.

function isGameOver(game: QuickGame, rules: QuickRules): Side | null;
// Returns winner side or null. Encapsulates deuce/cap logic.

function isMatchOver(match: QuickMatch): Side | null;
// Returns winner side based on completedGames vs ceil(bestOf / 2).

function gamesNeededToWinMatch(rules: QuickRules): number;
// Math.ceil(rules.bestOf / 2)

function currentServer(match: QuickMatch): Side;
// Whoever scored last in currentGame; defaults to 'A' if 0-0 (or could be configurable later — out of scope).
```

The store uses these functions immutably: each user action returns a new match object that overwrites the store slot.

## Scoring rules (precise)

Define `T = rules.pointsToWin` and `CAP = T + 9`.

**Without deuce:** Side X wins the game iff `X.score >= T`.

**With deuce:** Side X wins the game iff
- `X.score >= CAP` (cap rule: first to reach the cap wins regardless of margin), OR
- `X.score >= T` AND `X.score - opponent.score >= 2` (standard win-by-2).

Equivalently: at scores below `T-1 vs T-1` the deuce rule and no-deuce rule agree (whoever reaches `T` first leads by ≥2 by definition). Deuce only diverges from no-deuce at `T-1` ties or above.

**Match:** First side to win `Math.ceil(rules.bestOf / 2)` games — i.e., 1 of 1, or 2 of 3.

## User flows

### Flow A — Setup → Match → Complete (happy path)

1. User clicks "Quick Match — no login required" on `/login` or `/dashboard`.
2. Lands on `/quick` setup form:
   - Format toggle: Singles / Doubles (cosmetic)
   - Side A name (default placeholder "Side A")
   - Side B name (default placeholder "Side B")
   - Points to win (number stepper, default 21, range 1–99)
   - Best of (1 or 3 segmented buttons, default 1)
   - Deuce toggle (default ON)
3. Tap **Start match →** → store `createMatch(...)` → navigate to `/quick/play`.
4. `/quick/play` renders the scoring grid. Each side is a tappable area showing:
   - Side name (top)
   - Big current-game score (center)
   - "Tap to add point" hint (bottom)
5. Below the grid: completed-games row ("Games: 0–1, 21–19"), current server indicator, **Undo** button.
6. When `applyPoint` ends a game and the match is not over, a small modal/banner: "Game won by Side A (21–19) — Continue to game 2".
7. When the match ends, `/quick/play` flips to Complete state:
   - 🏆 Winner banner with side name
   - Game-by-game summary
   - **Rematch** (resets state to a fresh match with same names + rules) and **New match** (clears store, navigates to `/quick`) buttons

### Flow B — Mid-match recovery

User refreshes `/quick/play`. The Zustand store is in-memory (not persisted), so the match is lost. The page detects an empty store slot and redirects to `/quick`. (Documented as a known limitation.)

### Flow C — Undo

`Undo` decrements the last point in the current game. If history is empty (start of game), the button is disabled. Cross-game undo is not supported — once a game ends, that game's score is final.

## Setup form validation

| Field | Rule | Error copy |
|---|---|---|
| Side A name | Optional. Trimmed. ≤40 chars. | "Side name too long (40 char max)" |
| Side B name | Same as Side A | Same |
| Points to win | Required. Integer 1..99. | "Points must be between 1 and 99" |
| Best of | Required. Either 1 or 3. | (segmented; can't fail) |
| Deuce | Boolean | (toggle; can't fail) |

The **Start match** button is disabled until validation passes.

## Edge cases

| Case | Behavior |
|---|---|
| Points = 1 with deuce on | Engine handles correctly: `pointsToWin - 1 = 0`, so deuce kicks in immediately. Cap at `1 + 9 = 10`. Unusual but valid. |
| Both sides reach `pointsToWin + 9 - 1` simultaneously | The next point fires; whoever wins it hits the cap and wins. |
| User taps a side after match is over | UI disables the side cells in Complete state; no-op. |
| Empty side names submitted | Engine receives empty strings; UI displays placeholder defaults "Side A" / "Side B". |
| `pointsToWin = 0` or negative | Setup form blocks Start with inline error. Engine has a defensive guard but UI prevents reaching it. |
| Best of = 3, both sides win 1 game each | Game 3 plays to determine match winner. No "decider" special-casing. |
| User leaves `/quick/play` and returns | If store still holds match, page resumes scoring. If store is empty (new tab, fresh load), redirect to `/quick`. |

## Testing

### Tier 1 — Engine unit tests (`tests/lib/quick-match-engine.test.ts`)

Required cases:

**`createMatch`**
- Initial state has empty `completedGames`, `currentGame: {a:0, b:0, winner:null}`, `history: []`, `matchWinner: null`.

**`applyPoint` — no-deuce**
- 21-0: Side A reaches 21 → game winner A, currentGame resets, completedGames length 1.
- 21-19 → A wins game.
- 19-21 → B wins game.

**`applyPoint` — deuce on, `pointsToWin = 21` (so `CAP = 30`)**
- 21-19 → A wins (lead by 2 at threshold).
- 21-20 → game continues (lead by only 1).
- 22-20 → A wins (lead by 2 above threshold).
- 29-29 → game continues (neither at cap, no lead-by-2).
- 30-29 → A wins via cap.
- 29-30 → B wins via cap.
- After 29-29, the very next point on either side fires the cap and ends the game with a 1-point lead.

**Match progression**
- bestOf=1, A wins one game → matchWinner = 'A', no more games.
- bestOf=3, A wins games 1 and 2 → matchWinner = 'A' after game 2; game 3 not started.
- bestOf=3, A wins game 1, B wins game 2, A wins game 3 → matchWinner = 'A' after game 3.

**`undoLastPoint`**
- Apply 5 points A, 3 points B; undo 3 times; expect 5-0 (A history: AAAA, B history: empty).
- Undo on empty history is a no-op.
- Undo does NOT cross game boundaries: after a game ends and currentGame resets, `history` is empty; undo is a no-op even though completedGames is non-empty.

### Tier 2 — Manual smoke checklist (covered in plan execution, not automated)

- `/login` shows the button; tapping it opens `/quick`.
- `/dashboard` shows the button (signed-in organizer); tapping it opens `/quick`.
- Setup form submits with defaults; lands on `/quick/play`.
- Score a full match; verify Complete screen.
- Rematch resets correctly; New match returns to setup.
- Refresh on `/quick/play` redirects to `/quick`.

No UI tests for v1.

## Out of scope (deliberately, again)

- Persistence / sharing / spectator viewer
- Service-court tracking and side-swap rules
- Walkovers / forfeits
- Per-game stats / point history export
- Editing rules mid-match
- Per-player fields for doubles
- Authenticated quick matches (saving to a user's "match history")

## Open questions / future work

- Add a "Save & share" button on the Complete screen that snapshots the match to a `quickMatches/{id}` Firestore doc with a public-readable rule (clean v2).
- Add a court-rotation indicator so service-court is shown for the curious — engine already exposes `currentServer`.
- Allow custom `pointsToWin` chips (11, 15, 21, custom) instead of free-entry stepper, if user feedback indicates the stepper is friction.
