# Contributing to LoveAll

Thanks for wanting to help. This guide covers everything you need to get the app running locally, ship a change, and stay consistent with the existing codebase.

If you're looking for a user-facing overview of what the app does, see the [README](./README.md).

---

## Prerequisites

- **Node** 22+ (the repo is developed against 24.1.0)
- **npm** (ships with Node)
- **Git**
- A **Firebase project** with Auth (Email/Password + Anonymous) and Firestore enabled
- **firebase-tools** if you'll deploy: `npm install -g firebase-tools`
- **gh CLI** (optional, for PR / release work): `brew install gh && gh auth login`

For native dev (optional — web is the primary target):

- Xcode + an iOS simulator
- Android Studio + an emulator

---

## Local setup

```bash
# 1. Clone
git clone https://github.com/Aarashi01/LoveAll-Web-App.git
cd LoveAll-Web-App

# 2. Install
npm install

# 3. Firebase config
cp .env.example .env
# Fill in the EXPO_PUBLIC_FIREBASE_* values from
# Firebase Console → Project Settings → Web app

# 4. Run
npm run web        # Web at http://localhost:8081 (the primary target)
npm run ios        # iOS simulator (optional)
npm run android    # Android emulator (optional)
```

> Every env var is `EXPO_PUBLIC_*`-prefixed so it's bundled into the client. Don't put secrets here.

### One-time Firebase setup

If you're working against your own Firebase project:

```bash
firebase login
firebase use your-project-id
firebase deploy --only firestore:rules,firestore:indexes
```

---

## Tech stack

| Layer | Tool |
|---|---|
| App framework | Expo SDK 54 + Expo Router 6 (file-based routing) |
| UI | React Native + React Native Web (one codebase, all platforms) |
| Language | TypeScript (strict) |
| State | Zustand (`store/`) for app + scorekeeper + Quick Match; React Query for some server state |
| Backend | Firebase Auth + Firestore (real-time listeners) |
| Hosting | Firebase Hosting |
| Animation | react-native-reanimated v4 |
| Build | Metro (Expo's web bundler) → static export |

---

## Project structure

```
app/                          Expo Router screens (file = route)
├── (auth)/                   login, register
├── (organizer)/              authenticated tournament operations
│   └── [id]/                 manage, setup, schedule, results
├── (scorekeeper)/enter/      court-side scoring
├── (watch)/[slug]/           public live view
└── quick/                    no-login Quick Match

components/
├── ui/                       primitives — AppButton, AppCard, AppInput, ProfileMenu, TopBar
├── tournament/               TournamentCard, PlayerList
├── score/                    ScoreInput, GameScoreBar, IntervalTimer, LiveScoreCard
├── watch/                    WatchMatchCard, MatchScoreGrid, MatchSetSummary, MatchStatistics
├── bracket/                  GroupStandingsTable, KnockoutBracket
└── quick/                    QuickMatchButton CTA

constants/theme.ts            Design tokens (palette, type, spacing, radii)
hooks/                        useAuth, useMatches, useTournament
lib/
├── firebase.ts               Firebase init
├── firestore/                Firestore queries + types
├── quick-match-engine.ts     Pure game/match logic (deuce, cap, best-of, undo)
├── schedule-generator.ts     Group + knockout bracket generation
├── scorekeeper-session.ts    PIN/QR-validated scorekeeper session
├── player-excel.ts           Player roster import (exceljs)
└── pdf-generator.ts          Results export

store/                        Zustand stores
firestore.rules               Security rules (organizer / scorekeeper / public scopes)
firestore.indexes.json        Composite index definitions
firebase.json                 Hosting + Firestore config
```

---

## Scripts

| Script | What |
|---|---|
| `npm run start` | Expo dev server (pick platform from menu) |
| `npm run web` | Dev server for web at `http://localhost:8081` |
| `npm run ios` / `npm run android` | Native dev |
| `npm run build:web` | Static export to `dist/` |
| `npm run deploy:hosting` | Deploy `dist/` to Firebase Hosting |
| `npm run deploy:web` | `build:web` + `deploy:hosting` in one shot |
| `npx tsc --noEmit` | Type-check (always run before pushing) |

---

## Branch model

- `master` — production. Direct pushes are **blocked** by branch protection. Ship via PR.
- `vignesh/<slug>` / `<author>/<slug>` — long-running personal branches.
- `feat/<slug>`, `fix/<slug>`, `chore/<slug>`, `docs/<slug>` — short-lived feature branches off `master`.

Open PRs against `master`.

---

## Commits

Use [Conventional Commits](https://www.conventionalcommits.org/). Recent examples:

```
feat(ui): Nike-inspired redesign + Quick Match port
feat(scorekeeper): QR-pairing auth + swap excel parser to exceljs
docs: add user-facing README
chore: ignore .worktrees/ directory
```

Keep the subject line ≤ 72 chars and explain the **why** in the body, not just the what. The diff already shows what changed.

If you used Claude / another AI to help, add a co-author trailer:

```
Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

---

## Pull requests

1. Branch off the latest `master`.
2. Make your change. Run `npx tsc --noEmit` and `npm run web` to sanity-check.
3. Open a PR with the title following Conventional Commits and a body that includes:
   - **Summary** — what changed and why
   - **Test plan** — bullets of what you manually verified
4. Link to any relevant issue or design spec under `docs/superpowers/`.

Example:

```bash
gh pr create --base master --head feat/your-thing \
  --title "feat(scope): short imperative summary" \
  --body "## Summary
- ...

## Test plan
- [ ] ..."
```

---

## Design system

Tokens live in [`constants/theme.ts`](./constants/theme.ts). The aesthetic is monochrome + athletic, inspired by [Nike.in](https://www.nike.in/):

- **Surfaces**: paper white, jet-black ink for hero bands.
- **Accent**: a single Nike-red used sparingly for live status, urgency, and the Quick Match dot.
- **Geometry**: sharp rectangles for cards / inputs / segmented controls; pill (`borderRadius: 999`) reserved for CTAs and chips.
- **Type**: heavy weights with negative letter-spacing for headlines, uppercase tracking for eyebrows / labels.
- **Don't introduce**: backdrop-filter blur, glow orbs, gradient buttons, multi-colour accents.

If you're touching a screen, read the values from `theme.colors.*`, `theme.spacing.*`, `theme.radius.*` instead of hardcoding hex / px values. That keeps the whole app in lockstep with future palette tweaks.

Primitives to reach for first:

- `AppButton` (variants: `primary` / `secondary` / `danger` / `ghost`)
- `AppCard`
- `AppInput`
- `TopBar`
- `ProfileMenu`

---

## Testing

There is a `tests/lib/quick-match-engine.test.ts` describing the Quick Match scoring rules (deuce, cap, best-of, undo). Jest isn't currently wired into CI on `master` — `tsconfig.json` excludes `tests/**` until the test runner is added back.

When you wire jest in:

```bash
npm install --save-dev jest @types/jest jest-expo ts-jest
```

Then re-include `tests/**` in `tsconfig.json` and add a `test` script.

For new logic that isn't a screen, prefer pure functions (like `lib/quick-match-engine.ts`) so they're testable without React.

---

## Firestore

The schema is documented inline in [`lib/firestore/types.ts`](./lib/firestore/types.ts). High level:

- `users/{uid}` — user profile
- `tournaments/{id}` — public-readable when `publicViewEnabled === true`, organizer-writable
- `tournaments/{id}/matches/{matchId}` — match state, scores, history
- `tournaments/{id}/players/{playerId}` — registered players
- `tournaments/{id}/private/settings` — venue PIN, organizer-only
- `tournaments/{id}/scorekeeperAccess/{uid}` — validated scorekeeper grants

Security rules are in [`firestore.rules`](./firestore.rules). When you change them:

```bash
firebase deploy --only firestore:rules
```

When you add a new query that needs a composite index, Firestore will throw with a console URL — paste the resulting index definition into `firestore.indexes.json` and:

```bash
firebase deploy --only firestore:indexes
```

---

## Deploying

The hosted build deploys from whatever's in your local `dist/` (which is built from your working tree). Always deploy from a clean checkout of `master`:

```bash
git checkout master
git pull
npx tsc --noEmit
npm run deploy:web
```

`deploy:web` runs `build:web` + `firebase-tools deploy --only hosting`. It does **not** deploy Firestore rules or indexes — do those separately if they've changed.

After deploy, tag a release on the merge commit:

```bash
git tag -a vX.Y.Z -m "vX.Y.Z — short summary"
git push origin vX.Y.Z
gh release create vX.Y.Z --title "vX.Y.Z — short summary" --notes "..."
```

---

## Where to ask questions

- Design / spec docs live in [`docs/superpowers/`](./docs/superpowers/).
- Open a GitHub issue for bugs and feature requests.
- For private feedback, ping the repo owner directly.
