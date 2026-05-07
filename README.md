# LoveAll

Badminton tournament management and live scoring web app.

**Live**: [loveall-3ca71.web.app](https://loveall-3ca71.web.app)

Built with Expo Router, React Native Web, and Firebase. One codebase, ships to web today; iOS / Android-ready when you want them.

---

## What it does

LoveAll runs a badminton tournament from setup to scoreboard:

- **Organizer** — create a tournament, register players, generate a draw, schedule matches, publish results.
- **Scorekeeper** — score live matches court-side, with BWF-style game/match logic, deuce, intervals, and undo.
- **Spectator (Watch Party)** — public read-only view of live scores, set summaries, and statistics for any tournament with public view enabled.
- **Quick Match** — a no-login, no-tournament scoreboard for casual play. Two taps to start, massive split scoreboard, undo, rematch.

---

## Screens

| Route | Audience | What |
|---|---|---|
| `/login`, `/register` | All | Auth, with Quick Match shortcut |
| `/(organizer)/dashboard` | Organizer | Stat strip, tournament list, search, Quick Match CTA |
| `/(organizer)/new-tournament` | Organizer | Format, categories, scoring rules, venue PIN |
| `/(organizer)/[id]/manage` | Organizer | Operations hub — Players / Schedule / Results, PIN-gated when active |
| `/(organizer)/[id]/setup` | Organizer | Player registration, partner pairing, Excel import |
| `/(organizer)/[id]/schedule` | Organizer | Generated draws, court assignments, match list |
| `/(organizer)/[id]/results` | Organizer | Live results, PDF export |
| `/(scorekeeper)/enter/[matchId]` | Scorekeeper | BWF-compliant scoring with intervals + undo |
| `/(watch)/[slug]` | Spectator | Public match list with filter pills (All / Live / Completed) |
| `/(watch)/[slug]/match/[matchId]` | Spectator | Live score hero + set summary + statistics |
| `/quick`, `/quick/play` | Anyone | Quick Match — no login |

---

## Tech stack

- **App framework**: Expo SDK 54 + Expo Router 6 (file-based routing)
- **UI**: React Native + React Native Web (single codebase across web/iOS/Android)
- **State**: Zustand (app + scorekeeper + Quick Match stores), React Query (server-state subscriptions)
- **Backend**: Firebase Auth + Firestore (real-time listeners), Firebase Hosting
- **Animation**: react-native-reanimated v4
- **Lang**: TypeScript (strict)
- **Build**: Metro (Expo's web bundler) → static export

---

## Project structure

```
app/                          Expo Router screens (file-based)
├── (auth)/                   login, register
├── (organizer)/              authenticated dashboard + tournament operations
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

constants/theme.ts            Design tokens (Nike-inspired palette, type, spacing, radii)
hooks/                        useAuth, useMatches, useTournament
lib/
├── firebase.ts               Firebase init
├── firestore/                Firestore queries + types
├── quick-match-engine.ts     Pure game/match logic (deuce, cap, best-of, undo)
├── schedule-generator.ts     Group + knockout bracket generation
├── scorekeeper-session.ts    PIN/QR-validated scorekeeper session
├── player-excel.ts           Player roster import (exceljs)
└── pdf-generator.ts          Results export

store/                        Zustand stores (app, quick-match)
firestore.rules               Security rules — organizer / scorekeeper / public scopes
firebase.json                 Hosting + Firestore config
```

---

## Getting started

### Prerequisites

- Node 22+ (24.1.0 used in this repo)
- npm
- A Firebase project with Auth (Email/Password + Anonymous) and Firestore enabled
- `firebase-tools` (`npm install -g firebase-tools`) if you plan to deploy

### Install

```bash
git clone https://github.com/Aarashi01/LoveAll-Web-App.git
cd LoveAll-Web-App
npm install
```

### Configure Firebase

Copy `.env.example` to `.env` and fill in your project's keys (Project Settings → Web app):

```bash
cp .env.example .env
```

```
EXPO_PUBLIC_FIREBASE_API_KEY=...
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
EXPO_PUBLIC_FIREBASE_PROJECT_ID=your-project
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.firebasestorage.app
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
EXPO_PUBLIC_FIREBASE_APP_ID=...
EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID=...
```

Then deploy security rules + indexes once:

```bash
firebase login
firebase use your-project
firebase deploy --only firestore:rules,firestore:indexes
```

### Run

```bash
npm run web        # Web (the primary target — http://localhost:8081)
npm run ios        # iOS simulator
npm run android    # Android emulator
```

---

## Scripts

| Script | What |
|---|---|
| `npm run start` | Expo dev server (pick platform from menu) |
| `npm run web` | Dev server for web |
| `npm run ios` / `npm run android` | Native dev |
| `npm run build:web` | Static export to `dist/` (production bundle) |
| `npm run deploy:hosting` | Deploy `dist/` to Firebase Hosting |
| `npm run deploy:web` | `build:web` + `deploy:hosting` in one shot |

---

## Design system

Light, monochrome, athletic. Inspired by [Nike.in](https://www.nike.in/)'s aesthetic:

- **Surfaces**: paper white, jet-black ink for hero bands.
- **Accent**: a single Nike-red used sparingly for live status, urgency, and the Quick Match dot.
- **Geometry**: sharp rectangles for cards / inputs / segmented controls; pill (`borderRadius: 999`) reserved for CTAs and chips.
- **Type**: heavy display weights with negative letter-spacing for headlines, uppercase tracking for eyebrows / labels.
- **No glassmorphism** — no backdrop-filter blur, no glow orbs, no gradient buttons.

All design tokens live in `constants/theme.ts`. Most styling reads from those tokens; if you change a colour or radius there, the whole app moves with you.

---

## Branch model

- `master` — production. Deploy from here. Direct pushes are blocked; ship via PR.
- `vignesh/ui-layout` — current dev branch.
- Feature branches off `master`; open a PR back to `master`.

---

## Releases

Releases are tagged `vX.Y.Z` on `master` and listed at [Releases](https://github.com/Aarashi01/LoveAll-Web-App/releases). The current production build is **[v1.0.0](https://github.com/Aarashi01/LoveAll-Web-App/releases/tag/v1.0.0)**.

---

## License

No license declared yet — treat the source as "all rights reserved" until one is added.
