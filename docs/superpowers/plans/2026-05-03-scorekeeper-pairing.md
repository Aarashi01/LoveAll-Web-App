# Scorekeeper QR-Pairing Auth — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the bypass-prone PIN-based scorekeeper auth with a QR-pairing flow where the organizer explicitly approves each volunteer device, with end-of-day expiry and live revoke. Same milestone fixes audit item #2 by wrapping score writes in a Firestore transaction.

**Architecture:** Volunteer opens `/scorekeeper/join/[tournamentId]`, signs in anonymously, writes a `pairingRequests` doc with a random 32-byte nonce, and renders a QR encoding `{tid, uid, nonce}`. Organizer scans from their dashboard; their authenticated app validates the nonce, then writes `scorekeeperAccess/{volunteerUid}` with `expiresAt = next-midnight`. Firestore rules tighten so only the organizer can write `scorekeeperAccess`, and `expiresAt > request.time` is enforced server-side. Score writes go through `runTransaction()`.

**Tech Stack:** Expo SDK 54 (React Native + Web) · expo-router 6 · Firebase JS SDK 12 · React Query · Zustand · Jest + jest-expo · `@firebase/rules-unit-testing` · Firebase Emulator Suite · `react-native-qrcode-svg` · `expo-camera`.

**Spec:** `docs/superpowers/specs/2026-05-03-scorekeeper-pairing-design.md`

---

## File Map

**New files**

| Path | Purpose |
|---|---|
| `lib/nonce.ts` | Cryptographically random hex nonce generator |
| `lib/end-of-day.ts` | Pure helper: next-midnight `Date` in given timezone |
| `lib/scorekeeper-pairing.ts` | Volunteer side: create/refresh pairing request, subscribe to own access doc |
| `lib/firestore/scorekeeper-access.ts` | Organizer + shared: approve, revoke, list pending/active, cleanup expired |
| `app/(scorekeeper)/_layout.tsx` | Route guard wrapping all `(scorekeeper)` screens; subscribes to access doc |
| `app/(scorekeeper)/join/[tournamentId].tsx` | Pairing entry screen |
| `components/scorekeeper/PairingQR.tsx` | QR + 5-min countdown + refresh button |
| `components/scorekeeper/SessionBanner.tsx` | Persistent countdown banner |
| `components/scorekeeper/SessionExpiredModal.tsx` | Full-screen expiry/revoke modal |
| `components/organizer/PendingScorekeepersCard.tsx` | Live pending-requests card with Scan QR CTA |
| `components/organizer/ActiveScorekeepersList.tsx` | Live active-scorekeepers card with Revoke |
| `components/organizer/QRScannerModal.tsx` | Camera-based QR scanner using `expo-camera` |
| `scripts/migrate-remove-pin-system.ts` | One-shot cleanup of old PIN docs |
| `tests/lib/nonce.test.ts` | Nonce generator tests |
| `tests/lib/end-of-day.test.ts` | End-of-day tests |
| `tests/lib/banner-state.test.ts` | Banner state machine tests |
| `tests/firestore-rules.test.ts` | Firestore rules emulator tests |
| `jest.config.js` | Jest config (jest-expo preset) |
| `jest.setup.ts` | Test setup |
| `.firebaserc` (already exists, may add emulator config) | — |
| `firebase.json` (modified) | Add emulators block for rules tests |

**Modified files**

| Path | What changes |
|---|---|
| `firestore.rules` | Full rewrite per spec |
| `lib/firestore/types.ts` | Drop `venuePin` from `TournamentPrivateSettings` and `CreateTournamentInput`; replace `ScorekeeperAccess` shape; add `PairingRequest` |
| `lib/firestore/tournaments.ts` | Stop writing `private/settings`; remove `getTournamentPrivateSettings`, `validateScorekeeperAccess`, `grantScorekeeperAccess`, `revokeScorekeeperAccess` |
| `lib/firestore/matches.ts` | Wrap `updateScore` in `runTransaction`; wrap `completeMatch` in `writeBatch` |
| `store/app.store.ts` | Remove `pin` field; replace with anonymous-uid-aware session pointer |
| `app/(organizer)/new-tournament.tsx` | Remove venuePin form field, validation, and submit field |
| `app/(organizer)/[id]/manage.tsx` | Remove PIN reveal section; mount `PendingScorekeepersCard` and `ActiveScorekeepersList` |
| `app/(scorekeeper)/enter/[matchId].tsx` | Remove inline PIN-entry modal; rely on layout's route guard |
| `package.json` | Add deps: `react-native-qrcode-svg`, `expo-camera`; devDeps: `jest`, `jest-expo`, `@types/jest`, `@firebase/rules-unit-testing`, `tsx` |

**Deleted files**

| Path | Why |
|---|---|
| `lib/scorekeeper-session.ts` | Entire PIN flow replaced |

---

## Task 1: Add testing infrastructure (Jest + jest-expo)

**Files:**
- Create: `jest.config.js`
- Create: `jest.setup.ts`
- Modify: `package.json`

- [ ] **Step 1: Add devDependencies**

```bash
npm install --save-dev jest jest-expo @types/jest @firebase/rules-unit-testing tsx
```

Expected: dependencies install without error. `npm ls jest` shows a single Jest version.

- [ ] **Step 2: Create `jest.config.js`**

```js
/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  setupFiles: ['<rootDir>/jest.setup.ts'],
  testMatch: ['<rootDir>/tests/**/*.test.ts', '<rootDir>/tests/**/*.test.tsx'],
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg)/)',
  ],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
};
```

- [ ] **Step 3: Create `jest.setup.ts`**

```ts
// Reserved for global test setup. Currently empty; rules tests bring their own.
export {};
```

- [ ] **Step 4: Add `test` script to `package.json`**

In `package.json` `scripts`, add:

```json
"test": "jest",
"test:watch": "jest --watch"
```

- [ ] **Step 5: Verify Jest runs (zero tests is OK)**

Run: `npm test -- --passWithNoTests`
Expected: exits 0 with "No tests found" or "0 passed".

- [ ] **Step 6: Commit**

```bash
git add jest.config.js jest.setup.ts package.json package-lock.json
git commit -m "chore: add jest + rules-unit-testing infrastructure"
```

---

## Task 2: Pure helper — nonce generator

**Files:**
- Create: `lib/nonce.ts`
- Create: `tests/lib/nonce.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/lib/nonce.test.ts`:

```ts
import { generateNonce } from '@/lib/nonce';

describe('generateNonce', () => {
  it('returns a 64-character lowercase hex string by default', () => {
    const n = generateNonce();
    expect(n).toMatch(/^[0-9a-f]{64}$/);
  });

  it('produces unique values across many calls', () => {
    const set = new Set<string>();
    for (let i = 0; i < 10_000; i++) set.add(generateNonce());
    expect(set.size).toBe(10_000);
  });

  it('respects the byte-length argument', () => {
    expect(generateNonce(16)).toMatch(/^[0-9a-f]{32}$/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- nonce.test`
Expected: FAIL — "Cannot find module '@/lib/nonce'".

- [ ] **Step 3: Write minimal implementation**

Create `lib/nonce.ts`:

```ts
/**
 * Cryptographically random hex string. Uses the platform's WebCrypto
 * (available in modern React Native + browsers via getRandomValues).
 */
export function generateNonce(byteLength: number = 32): string {
  const bytes = new Uint8Array(byteLength);
  // globalThis.crypto is provided by browsers and React Native (Hermes 0.74+).
  globalThis.crypto.getRandomValues(bytes);
  let hex = '';
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, '0');
  }
  return hex;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- nonce.test`
Expected: 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/nonce.ts tests/lib/nonce.test.ts
git commit -m "feat(lib): add cryptographic nonce generator with tests"
```

---

## Task 3: Pure helper — end-of-day timestamp

**Files:**
- Create: `lib/end-of-day.ts`
- Create: `tests/lib/end-of-day.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/lib/end-of-day.test.ts`:

```ts
import { nextMidnight, MAX_SESSION_HOURS } from '@/lib/end-of-day';

describe('nextMidnight', () => {
  it('returns the next 00:00 of the same day if before midnight', () => {
    const now = new Date('2026-05-03T15:30:00.000Z');
    const result = nextMidnight(now);
    // Just verify "later today or tomorrow at exactly 00:00:00.000"
    expect(result.getHours()).toBe(0);
    expect(result.getMinutes()).toBe(0);
    expect(result.getSeconds()).toBe(0);
    expect(result.getMilliseconds()).toBe(0);
    expect(result.getTime()).toBeGreaterThan(now.getTime());
  });

  it('returns a timestamp within MAX_SESSION_HOURS of now', () => {
    const now = new Date('2026-05-03T03:30:00.000Z');
    const result = nextMidnight(now);
    const diffHours = (result.getTime() - now.getTime()) / (1000 * 60 * 60);
    expect(diffHours).toBeLessThanOrEqual(MAX_SESSION_HOURS);
    expect(diffHours).toBeGreaterThan(0);
  });

  it('exposes MAX_SESSION_HOURS = 24 to match Firestore rule cap', () => {
    expect(MAX_SESSION_HOURS).toBe(24);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- end-of-day.test`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

Create `lib/end-of-day.ts`:

```ts
/**
 * Hard cap on a scorekeeper session in hours. Mirrors the Firestore rule
 * cap on `scorekeeperAccess.expiresAt` (now + 24h).
 */
export const MAX_SESSION_HOURS = 24;

/**
 * Returns the next 00:00:00 in the *device's local timezone*, computed
 * from `from` (defaults to now).
 *
 * NOTE: We deliberately use device-local time. Per the spec, per-tournament
 * timezone configuration is a documented limitation / future feature.
 */
export function nextMidnight(from: Date = new Date()): Date {
  const next = new Date(from);
  next.setHours(24, 0, 0, 0); // rolls into next day at exactly midnight local
  return next;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- end-of-day.test`
Expected: 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/end-of-day.ts tests/lib/end-of-day.test.ts
git commit -m "feat(lib): add nextMidnight helper with tests"
```

---

## Task 4: Update Firestore types for the new collections

**Files:**
- Modify: `lib/firestore/types.ts`

- [ ] **Step 1: Replace `ScorekeeperAccess` and add `PairingRequest`**

In `lib/firestore/types.ts`, replace the existing `ScorekeeperAccess` interface (currently lines 57-61) with:

```ts
export interface ScorekeeperAccess {
  tournamentId: string;
  approvedAt: FirestoreDate;
  approvedBy: string;       // organizer UID (audit trail)
  expiresAt: FirestoreDate; // next midnight, capped at +24h by rules
  deviceLabel: string;
}

export interface PairingRequest {
  id: string;
  scorekeeperUid: string;
  nonce: string;
  deviceLabel: string;
  createdAt: FirestoreDate;
  expiresAt: FirestoreDate;
}

/**
 * Payload encoded into the QR shown by the volunteer.
 * Kept small — gets URL-safe base64'd into the QR image.
 */
export interface PairingQRPayload {
  v: 1;                  // schema version
  tid: string;           // tournamentId
  uid: string;           // scorekeeperUid (anonymous Firebase UID)
  nonce: string;         // 64-char hex
}
```

- [ ] **Step 2: Drop `venuePin` from `TournamentPrivateSettings` and `CreateTournamentInput`**

Replace `TournamentPrivateSettings` (currently lines 41-43) with a deprecation marker so we can grep it later:

```ts
/** @deprecated Removed with the PIN system. Schedule for full deletion after migration runs. */
export interface TournamentPrivateSettings {
  // Intentionally empty; left for one release cycle only.
}
```

In `CreateTournamentInput`, **remove** the line `venuePin: string;` (currently line 54).

- [ ] **Step 3: Verify the project still type-checks**

Run: `npx tsc --noEmit`
Expected: type errors only at the *callsites* that reference `venuePin` or the old `ScorekeeperAccess.validated` field. Those callsites are fixed in later tasks. Note them down — they should be: `app/(organizer)/new-tournament.tsx`, `app/(organizer)/[id]/manage.tsx`, `lib/firestore/tournaments.ts`, `lib/scorekeeper-session.ts`.

- [ ] **Step 4: Commit**

```bash
git add lib/firestore/types.ts
git commit -m "refactor(types): replace ScorekeeperAccess shape, add PairingRequest types

Drops the venuePin/validated fields. Downstream callsites fixed in
follow-up commits — type errors expected at this commit boundary."
```

---

## Task 5: Update Firestore rules

**Files:**
- Modify: `firestore.rules`

- [ ] **Step 1: Replace the entire rules file**

Overwrite `firestore.rules` with:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    function isSignedIn() {
      return request.auth != null;
    }

    function isOrganizer(tournamentId) {
      let t = get(/databases/$(database)/documents/tournaments/$(tournamentId));
      return isSignedIn() && t.data.organizerId == request.auth.uid;
    }

    function isActiveScorekeeper(tournamentId) {
      let access = get(/databases/$(database)/documents/tournaments/$(tournamentId)/scorekeeperAccess/$(request.auth.uid));
      return isSignedIn()
          && access != null
          && access.data.expiresAt > request.time;
    }

    function isPubliclyViewable(tournamentId) {
      return get(/databases/$(database)/documents/tournaments/$(tournamentId)).data.publicViewEnabled == true;
    }

    match /users/{userId} {
      allow read, write: if isSignedIn() && request.auth.uid == userId;
    }

    match /tournaments/{tournamentId} {
      allow read:   if resource.data.publicViewEnabled == true
                    || (isSignedIn() && request.auth.uid == resource.data.organizerId);
      allow create: if isSignedIn();
      allow update,
            delete: if isSignedIn()
                    && request.auth.uid == resource.data.organizerId;

      match /pairingRequests/{requestId} {
        allow create: if isSignedIn()
                      && request.resource.data.scorekeeperUid == request.auth.uid
                      && request.resource.data.keys().hasAll(
                           ['scorekeeperUid', 'nonce', 'deviceLabel', 'createdAt', 'expiresAt'])
                      && request.resource.data.nonce is string
                      && request.resource.data.nonce.size() >= 32
                      && request.resource.data.deviceLabel is string
                      && request.resource.data.deviceLabel.size() <= 64
                      && request.resource.data.expiresAt is timestamp
                      && request.resource.data.expiresAt < request.time + duration.value(10, 'm');

        allow read:   if isOrganizer(tournamentId)
                      || (isSignedIn() && resource.data.scorekeeperUid == request.auth.uid);

        allow delete: if isOrganizer(tournamentId)
                      || (isSignedIn() && resource.data.scorekeeperUid == request.auth.uid);

        allow update: if false;
      }

      match /scorekeeperAccess/{scorekeeperUid} {
        allow read: if isOrganizer(tournamentId)
                    || (isSignedIn() && scorekeeperUid == request.auth.uid);

        allow create: if isOrganizer(tournamentId)
                      && request.resource.data.keys().hasAll(
                           ['tournamentId', 'approvedAt', 'approvedBy', 'expiresAt', 'deviceLabel'])
                      && request.resource.data.tournamentId == tournamentId
                      && request.resource.data.approvedBy == request.auth.uid
                      && request.resource.data.expiresAt is timestamp
                      && request.resource.data.expiresAt > request.time
                      && request.resource.data.expiresAt < request.time + duration.value(24, 'h');

        allow update: if isOrganizer(tournamentId)
                      && request.resource.data.tournamentId == tournamentId
                      && request.resource.data.expiresAt > request.time
                      && request.resource.data.expiresAt < request.time + duration.value(24, 'h');

        allow delete: if isOrganizer(tournamentId);
      }

      match /players/{playerId} {
        allow read:  if isPubliclyViewable(tournamentId)
                     || isOrganizer(tournamentId)
                     || isActiveScorekeeper(tournamentId);
        allow write: if isOrganizer(tournamentId);
      }

      match /matches/{matchId} {
        allow read:  if isPubliclyViewable(tournamentId)
                     || isOrganizer(tournamentId)
                     || isActiveScorekeeper(tournamentId);
        allow create,
              delete: if isOrganizer(tournamentId);
        allow update: if isOrganizer(tournamentId)
                      || isActiveScorekeeper(tournamentId);
      }
    }
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add firestore.rules
git commit -m "feat(rules): close scorekeeperAccess bypass; add pairingRequests subcollection

Removes the self-write bypass on scorekeeperAccess (now organizer-only).
Adds short-lived pairingRequests collection. Tightens matches to update-only
for scorekeepers. Removes private/settings (PIN no longer exists)."
```

---

## Task 6: Configure Firebase emulator for rules tests

**Files:**
- Modify: `firebase.json`

- [ ] **Step 1: Read current firebase.json**

Run: `cat firebase.json`
Note the existing top-level keys.

- [ ] **Step 2: Add emulators block**

Edit `firebase.json` to include (merge with existing keys; do not overwrite hosting/firestore config):

```json
{
  "emulators": {
    "firestore": {
      "port": 8080
    },
    "ui": {
      "enabled": true
    },
    "singleProjectMode": true
  }
}
```

- [ ] **Step 3: Verify emulator starts**

Run: `npx firebase emulators:start --only firestore` (in a separate terminal)
Expected: prints `firestore: started on 127.0.0.1:8080`. Stop with Ctrl+C.

- [ ] **Step 4: Commit**

```bash
git add firebase.json
git commit -m "chore(firebase): configure firestore emulator for rules tests"
```

---

## Task 7: Firestore rules emulator tests

**Files:**
- Create: `tests/firestore-rules.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/firestore-rules.test.ts`:

```ts
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';

const PROJECT_ID = 'loveall-rules-test';
const TID = 'tour1';

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: readFileSync(resolve(__dirname, '../firestore.rules'), 'utf8'),
      host: '127.0.0.1',
      port: 8080,
    },
  });
});

afterAll(async () => {
  await env.cleanup();
});

beforeEach(async () => {
  await env.clearFirestore();
  // Seed a tournament owned by 'organizerUid'
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'tournaments', TID), {
      id: TID,
      organizerId: 'organizerUid',
      publicViewEnabled: false,
    });
  });
});

function authedDb(uid: string) {
  return env.authenticatedContext(uid).firestore();
}

const futureTs = (mins: number) =>
  Timestamp.fromMillis(Date.now() + mins * 60 * 1000);

describe('scorekeeperAccess rules', () => {
  it('blocks a volunteer from self-granting access (the bypass we are closing)', async () => {
    const db = authedDb('volunteerUid');
    await assertFails(
      setDoc(doc(db, 'tournaments', TID, 'scorekeeperAccess', 'volunteerUid'), {
        tournamentId: TID,
        approvedAt: serverTimestamp(),
        approvedBy: 'volunteerUid',
        expiresAt: futureTs(60),
        deviceLabel: 'sneaky',
      }),
    );
  });

  it('allows the organizer to grant access', async () => {
    const db = authedDb('organizerUid');
    await assertSucceeds(
      setDoc(doc(db, 'tournaments', TID, 'scorekeeperAccess', 'volunteerUid'), {
        tournamentId: TID,
        approvedAt: serverTimestamp(),
        approvedBy: 'organizerUid',
        expiresAt: futureTs(60),
        deviceLabel: 'Pixel',
      }),
    );
  });

  it('rejects expiresAt more than 24h out', async () => {
    const db = authedDb('organizerUid');
    await assertFails(
      setDoc(doc(db, 'tournaments', TID, 'scorekeeperAccess', 'volunteerUid'), {
        tournamentId: TID,
        approvedAt: serverTimestamp(),
        approvedBy: 'organizerUid',
        expiresAt: futureTs(60 * 25),
        deviceLabel: 'Pixel',
      }),
    );
  });

  it('allows the organizer to revoke', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(
        doc(ctx.firestore(), 'tournaments', TID, 'scorekeeperAccess', 'volunteerUid'),
        {
          tournamentId: TID,
          approvedAt: serverTimestamp(),
          approvedBy: 'organizerUid',
          expiresAt: futureTs(60),
          deviceLabel: 'Pixel',
        },
      );
    });
    const db = authedDb('organizerUid');
    await assertSucceeds(
      // delete via setDoc(undefined) isn't supported; use deleteDoc
      // imported lazily to keep top-of-file imports tidy
      (await import('firebase/firestore')).deleteDoc(
        doc(db, 'tournaments', TID, 'scorekeeperAccess', 'volunteerUid'),
      ),
    );
  });
});

describe('pairingRequests rules', () => {
  const NONCE = 'a'.repeat(64);

  it('allows volunteer to create their own request', async () => {
    const db = authedDb('volunteerUid');
    await assertSucceeds(
      setDoc(doc(db, 'tournaments', TID, 'pairingRequests', 'r1'), {
        scorekeeperUid: 'volunteerUid',
        nonce: NONCE,
        deviceLabel: 'iPhone',
        createdAt: serverTimestamp(),
        expiresAt: futureTs(5),
      }),
    );
  });

  it('blocks volunteer from creating a request for someone else', async () => {
    const db = authedDb('volunteerUid');
    await assertFails(
      setDoc(doc(db, 'tournaments', TID, 'pairingRequests', 'r2'), {
        scorekeeperUid: 'someoneElse',
        nonce: NONCE,
        deviceLabel: 'iPhone',
        createdAt: serverTimestamp(),
        expiresAt: futureTs(5),
      }),
    );
  });

  it('blocks an expiresAt > 10 minutes out', async () => {
    const db = authedDb('volunteerUid');
    await assertFails(
      setDoc(doc(db, 'tournaments', TID, 'pairingRequests', 'r3'), {
        scorekeeperUid: 'volunteerUid',
        nonce: NONCE,
        deviceLabel: 'iPhone',
        createdAt: serverTimestamp(),
        expiresAt: futureTs(20),
      }),
    );
  });
});

describe('matches rules — scorekeeper access gating', () => {
  beforeEach(async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(
        doc(ctx.firestore(), 'tournaments', TID, 'matches', 'm1'),
        { id: 'm1', status: 'scheduled', scores: [] },
      );
    });
  });

  it('blocks a non-scorekeeper from updating a match', async () => {
    const db = authedDb('randomUid');
    await assertFails(
      updateDoc(doc(db, 'tournaments', TID, 'matches', 'm1'), { status: 'live' }),
    );
  });

  it('blocks an EXPIRED scorekeeper from updating a match', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(
        doc(ctx.firestore(), 'tournaments', TID, 'scorekeeperAccess', 'volunteerUid'),
        {
          tournamentId: TID,
          approvedAt: serverTimestamp(),
          approvedBy: 'organizerUid',
          expiresAt: Timestamp.fromMillis(Date.now() - 60 * 1000),
          deviceLabel: 'old',
        },
      );
    });
    const db = authedDb('volunteerUid');
    await assertFails(
      updateDoc(doc(db, 'tournaments', TID, 'matches', 'm1'), { status: 'live' }),
    );
  });

  it('allows an active scorekeeper to update a match', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(
        doc(ctx.firestore(), 'tournaments', TID, 'scorekeeperAccess', 'volunteerUid'),
        {
          tournamentId: TID,
          approvedAt: serverTimestamp(),
          approvedBy: 'organizerUid',
          expiresAt: futureTs(60),
          deviceLabel: 'OK',
        },
      );
    });
    const db = authedDb('volunteerUid');
    await assertSucceeds(
      updateDoc(doc(db, 'tournaments', TID, 'matches', 'm1'), { status: 'live' }),
    );
  });

  it('blocks a scorekeeper from CREATING a match', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(
        doc(ctx.firestore(), 'tournaments', TID, 'scorekeeperAccess', 'volunteerUid'),
        {
          tournamentId: TID,
          approvedAt: serverTimestamp(),
          approvedBy: 'organizerUid',
          expiresAt: futureTs(60),
          deviceLabel: 'OK',
        },
      );
    });
    const db = authedDb('volunteerUid');
    await assertFails(
      setDoc(doc(db, 'tournaments', TID, 'matches', 'mNew'), { id: 'mNew' }),
    );
  });
});

describe('public viewer', () => {
  it('reads matches when publicViewEnabled is true', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'tournaments', TID), {
        id: TID,
        organizerId: 'organizerUid',
        publicViewEnabled: true,
      });
      await setDoc(doc(ctx.firestore(), 'tournaments', TID, 'matches', 'mPub'), {
        id: 'mPub',
      });
    });
    const db = env.unauthenticatedContext().firestore();
    await assertSucceeds(getDoc(doc(db, 'tournaments', TID, 'matches', 'mPub')));
  });

  it('denies match read when publicViewEnabled is false', async () => {
    const db = env.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(db, 'tournaments', TID, 'matches', 'm1')));
  });
});
```

- [ ] **Step 2: Run the rules tests against the emulator**

In one terminal: `npx firebase emulators:start --only firestore`
In another: `npm test -- firestore-rules.test`
Expected: all tests pass. The first one (`blocks a volunteer from self-granting access`) is the bypass-closure assertion.

- [ ] **Step 3: Add convenience script to `package.json`**

In `scripts`, add:

```json
"test:rules": "firebase emulators:exec --only firestore 'jest tests/firestore-rules.test.ts'"
```

Run once: `npm run test:rules`
Expected: same tests pass; emulator is auto-started + torn down.

- [ ] **Step 4: Commit**

```bash
git add tests/firestore-rules.test.ts package.json
git commit -m "test(rules): add emulator-backed rules tests proving the bypass is closed"
```

---

## Task 8: Volunteer-side library — `lib/scorekeeper-pairing.ts`

**Files:**
- Create: `lib/scorekeeper-pairing.ts`

- [ ] **Step 1: Write the implementation**

Create `lib/scorekeeper-pairing.ts`:

```ts
import { signInAnonymously } from 'firebase/auth';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  Timestamp,
  type Unsubscribe,
} from 'firebase/firestore';
import { Platform } from 'react-native';

import { auth, db } from '@/lib/firebase';
import { generateNonce } from '@/lib/nonce';
import type {
  PairingQRPayload,
  PairingRequest,
  ScorekeeperAccess,
} from '@/lib/firestore/types';

const PAIRING_TTL_MS = 5 * 60 * 1000; // 5 minutes; rule caps at 10

export async function ensureAnonymousAuth(): Promise<string> {
  if (auth.currentUser) return auth.currentUser.uid;
  const cred = await signInAnonymously(auth);
  return cred.user.uid;
}

export function defaultDeviceLabel(): string {
  if (Platform.OS === 'ios') return 'iPhone';
  if (Platform.OS === 'android') return 'Android phone';
  if (Platform.OS === 'web') return 'Web browser';
  return Platform.OS;
}

export interface CreatePairingResult {
  requestId: string;
  payload: PairingQRPayload;
  expiresAtMs: number;
}

export async function createPairingRequest(
  tournamentId: string,
  deviceLabel: string,
): Promise<CreatePairingResult> {
  const uid = await ensureAnonymousAuth();
  const nonce = generateNonce();
  const expiresAt = Timestamp.fromMillis(Date.now() + PAIRING_TTL_MS);

  const created = await addDoc(
    collection(db, 'tournaments', tournamentId, 'pairingRequests'),
    {
      scorekeeperUid: uid,
      nonce,
      deviceLabel: deviceLabel.slice(0, 64),
      createdAt: serverTimestamp(),
      expiresAt,
    },
  );

  return {
    requestId: created.id,
    payload: { v: 1, tid: tournamentId, uid, nonce },
    expiresAtMs: expiresAt.toMillis(),
  };
}

export async function deletePairingRequest(
  tournamentId: string,
  requestId: string,
): Promise<void> {
  await deleteDoc(
    doc(db, 'tournaments', tournamentId, 'pairingRequests', requestId),
  );
}

/** Subscribe to the volunteer's own access doc to detect approval/revoke. */
export function subscribeToOwnAccess(
  tournamentId: string,
  uid: string,
  onChange: (access: ScorekeeperAccess | null) => void,
): Unsubscribe {
  const ref = doc(db, 'tournaments', tournamentId, 'scorekeeperAccess', uid);
  return onSnapshot(ref, (snap) => {
    if (!snap.exists()) {
      onChange(null);
      return;
    }
    onChange(snap.data() as ScorekeeperAccess);
  });
}

export function isAccessActive(access: ScorekeeperAccess | null): boolean {
  if (!access) return false;
  return access.expiresAt.toMillis() > Date.now();
}

export function encodeQRPayload(payload: PairingQRPayload): string {
  // QR encodes JSON directly. Compact form, no whitespace.
  return JSON.stringify(payload);
}

export function decodeQRPayload(raw: string): PairingQRPayload | null {
  try {
    const parsed = JSON.parse(raw);
    if (
      parsed &&
      parsed.v === 1 &&
      typeof parsed.tid === 'string' &&
      typeof parsed.uid === 'string' &&
      typeof parsed.nonce === 'string' &&
      parsed.nonce.length >= 32
    ) {
      return parsed as PairingQRPayload;
    }
  } catch {
    // fall through
  }
  return null;
}

// Re-export for convenience in screens.
export type { PairingRequest, PairingQRPayload, ScorekeeperAccess };
```

- [ ] **Step 2: Verify type-check**

Run: `npx tsc --noEmit`
Expected: no new errors in this file. Pre-existing errors from Task 4 still present at PIN callsites.

- [ ] **Step 3: Commit**

```bash
git add lib/scorekeeper-pairing.ts
git commit -m "feat(lib): add volunteer-side pairing library (anonymous auth + QR payload)"
```

---

## Task 9: Organizer-side library — `lib/firestore/scorekeeper-access.ts`

**Files:**
- Create: `lib/firestore/scorekeeper-access.ts`

- [ ] **Step 1: Write the implementation**

Create `lib/firestore/scorekeeper-access.ts`:

```ts
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  where,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore';

import { auth, db } from '@/lib/firebase';
import { nextMidnight, MAX_SESSION_HOURS } from '@/lib/end-of-day';
import type {
  PairingRequest,
  PairingQRPayload,
  ScorekeeperAccess,
} from '@/lib/firestore/types';

function pairingRequestsRef(tournamentId: string) {
  return collection(db, 'tournaments', tournamentId, 'pairingRequests');
}

function accessRef(tournamentId: string) {
  return collection(db, 'tournaments', tournamentId, 'scorekeeperAccess');
}

function accessDoc(tournamentId: string, scorekeeperUid: string) {
  return doc(db, 'tournaments', tournamentId, 'scorekeeperAccess', scorekeeperUid);
}

/** Subscribe to all pending requests (organizer view). */
export function subscribeToPendingRequests(
  tournamentId: string,
  onData: (rows: PairingRequest[]) => void,
): Unsubscribe {
  return onSnapshot(pairingRequestsRef(tournamentId), (snap) => {
    const now = Date.now();
    const rows = snap.docs
      .map((d) => ({ id: d.id, ...(d.data() as Omit<PairingRequest, 'id'>) }))
      .filter((r) => r.expiresAt && r.expiresAt.toMillis() > now)
      .sort((a, b) => a.createdAt.toMillis() - b.createdAt.toMillis());
    onData(rows);
  });
}

/** Subscribe to active (non-expired) approved scorekeepers (organizer view). */
export function subscribeToActiveScorekeepers(
  tournamentId: string,
  onData: (rows: Array<ScorekeeperAccess & { uid: string }>) => void,
): Unsubscribe {
  return onSnapshot(accessRef(tournamentId), (snap) => {
    const now = Date.now();
    const rows = snap.docs
      .map((d) => ({ uid: d.id, ...(d.data() as ScorekeeperAccess) }))
      .filter((r) => r.expiresAt && r.expiresAt.toMillis() > now)
      .sort((a, b) => a.expiresAt.toMillis() - b.expiresAt.toMillis());
    onData(rows);
  });
}

export interface ApproveResult {
  ok: true;
}

export interface ApproveError {
  ok: false;
  reason:
    | 'request-not-found'
    | 'nonce-mismatch'
    | 'request-expired'
    | 'organizer-not-signed-in';
}

/**
 * Validates a scanned QR against the matching pending request, then writes
 * the access doc and deletes the pairing request.
 */
export async function approveScorekeeper(
  payload: PairingQRPayload,
  pending: PairingRequest[],
): Promise<ApproveResult | ApproveError> {
  const organizer = auth.currentUser;
  if (!organizer) return { ok: false, reason: 'organizer-not-signed-in' };

  const match = pending.find(
    (p) => p.scorekeeperUid === payload.uid && p.nonce === payload.nonce,
  );
  if (!match) return { ok: false, reason: 'nonce-mismatch' };
  if (match.expiresAt.toMillis() <= Date.now()) {
    return { ok: false, reason: 'request-expired' };
  }

  const expiresAt = Timestamp.fromDate(nextMidnight());
  // Defensive cap (rules also enforce +24h)
  const maxAllowed = Date.now() + MAX_SESSION_HOURS * 60 * 60 * 1000;
  const cappedExpiresAt = expiresAt.toMillis() > maxAllowed
    ? Timestamp.fromMillis(maxAllowed - 1000)
    : expiresAt;

  const batch = writeBatch(db);
  batch.set(accessDoc(payload.tid, payload.uid), {
    tournamentId: payload.tid,
    approvedAt: serverTimestamp(),
    approvedBy: organizer.uid,
    expiresAt: cappedExpiresAt,
    deviceLabel: match.deviceLabel,
  });
  batch.delete(doc(pairingRequestsRef(payload.tid), match.id));
  await batch.commit();

  return { ok: true };
}

export async function revokeScorekeeper(
  tournamentId: string,
  scorekeeperUid: string,
): Promise<void> {
  await deleteDoc(accessDoc(tournamentId, scorekeeperUid));
}

/**
 * Best-effort cleanup of expired access docs. Safe to call from any
 * organizer-authenticated screen on mount; failures are swallowed.
 */
export async function cleanupExpiredAccess(tournamentId: string): Promise<void> {
  try {
    const snap = await getDocs(
      query(accessRef(tournamentId), where('expiresAt', '<', Timestamp.now())),
    );
    if (snap.empty) return;
    const batch = writeBatch(db);
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
  } catch {
    // Non-fatal: if rules deny, we just leave the docs.
  }
}
```

- [ ] **Step 2: Verify type-check**

Run: `npx tsc --noEmit`
Expected: no new errors in this file.

- [ ] **Step 3: Commit**

```bash
git add lib/firestore/scorekeeper-access.ts
git commit -m "feat(lib): add organizer-side scorekeeper-access library

Provides approveScorekeeper, revokeScorekeeper, subscribeToPendingRequests,
subscribeToActiveScorekeepers, and opportunistic cleanupExpiredAccess."
```

---

## Task 10: Banner state machine + tests

**Files:**
- Create: `lib/banner-state.ts`
- Create: `tests/lib/banner-state.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/lib/banner-state.test.ts`:

```ts
import { computeBannerState } from '@/lib/banner-state';

describe('computeBannerState', () => {
  it('returns "expired" when remaining ≤ 0', () => {
    expect(computeBannerState(0)).toBe('expired');
    expect(computeBannerState(-1000)).toBe('expired');
  });

  it('returns "critical" when ≤ 5 minutes remain', () => {
    expect(computeBannerState(4 * 60 * 1000)).toBe('critical');
    expect(computeBannerState(1)).toBe('critical');
  });

  it('returns "warning" when 5–30 minutes remain', () => {
    expect(computeBannerState(6 * 60 * 1000)).toBe('warning');
    expect(computeBannerState(29 * 60 * 1000)).toBe('warning');
  });

  it('returns "ok" when > 30 minutes remain', () => {
    expect(computeBannerState(31 * 60 * 1000)).toBe('ok');
    expect(computeBannerState(8 * 60 * 60 * 1000)).toBe('ok');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- banner-state.test`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

Create `lib/banner-state.ts`:

```ts
export type BannerState = 'ok' | 'warning' | 'critical' | 'expired';

const FIVE_MIN = 5 * 60 * 1000;
const THIRTY_MIN = 30 * 60 * 1000;

/** Maps milliseconds-remaining to a banner state. Pure function. */
export function computeBannerState(msRemaining: number): BannerState {
  if (msRemaining <= 0) return 'expired';
  if (msRemaining <= FIVE_MIN) return 'critical';
  if (msRemaining <= THIRTY_MIN) return 'warning';
  return 'ok';
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- banner-state.test`
Expected: 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/banner-state.ts tests/lib/banner-state.test.ts
git commit -m "feat(lib): add banner state machine with tests"
```

---

## Task 11: `PairingQR` component (volunteer side)

**Files:**
- Create: `components/scorekeeper/PairingQR.tsx`
- Modify: `package.json` (add `react-native-qrcode-svg`)

- [ ] **Step 1: Install dependency**

```bash
npm install react-native-qrcode-svg
npx expo install react-native-svg
```

`react-native-svg` is the underlying renderer that `react-native-qrcode-svg` requires; install via `expo install` so the Expo SDK 54-compatible version is selected. (`react-native-qrcode-svg` itself isn't an Expo module, so `npm install` is correct for it.)

- [ ] **Step 2: Write the component**

Create `components/scorekeeper/PairingQR.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import { encodeQRPayload, type PairingQRPayload } from '@/lib/scorekeeper-pairing';

interface Props {
  payload: PairingQRPayload;
  expiresAtMs: number;
  onRefresh: () => void;
}

function formatRemaining(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function PairingQR({ payload, expiresAtMs, onRefresh }: Props) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const remaining = expiresAtMs - now;
  const expired = remaining <= 0;

  return (
    <View style={styles.container}>
      <View style={styles.qrFrame}>
        <QRCode value={encodeQRPayload(payload)} size={240} />
      </View>
      {expired ? (
        <>
          <Text style={styles.expiredText}>QR expired</Text>
          <Pressable style={styles.refreshBtn} onPress={onRefresh}>
            <Text style={styles.refreshBtnText}>Get a new QR</Text>
          </Pressable>
        </>
      ) : (
        <Text style={styles.countdown}>
          Show this to the organizer · expires in {formatRemaining(remaining)}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', gap: 16 },
  qrFrame: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
  },
  countdown: { color: '#94A3B8', fontSize: 14, textAlign: 'center' },
  expiredText: { color: '#F87171', fontSize: 16, fontWeight: '600' },
  refreshBtn: {
    backgroundColor: '#3B82F6',
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  refreshBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
});
```

- [ ] **Step 3: Commit**

```bash
git add components/scorekeeper/PairingQR.tsx package.json package-lock.json
git commit -m "feat(scorekeeper): add PairingQR component"
```

---

## Task 12: `SessionBanner` and `SessionExpiredModal` components

**Files:**
- Create: `components/scorekeeper/SessionBanner.tsx`
- Create: `components/scorekeeper/SessionExpiredModal.tsx`

- [ ] **Step 1: Create `SessionBanner.tsx`**

```tsx
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { computeBannerState } from '@/lib/banner-state';

interface Props {
  expiresAtMs: number;
}

const COLORS: Record<ReturnType<typeof computeBannerState>, { bg: string; fg: string }> = {
  ok:       { bg: '#1E293B', fg: '#94A3B8' },
  warning:  { bg: '#78350F', fg: '#FCD34D' },
  critical: { bg: '#7F1D1D', fg: '#FECACA' },
  expired:  { bg: '#7F1D1D', fg: '#FECACA' },
};

function formatHM(msRemaining: number): string {
  const total = Math.max(0, Math.floor(msRemaining / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m >= 5) return `${m} min`;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function endTimeText(expiresAtMs: number): string {
  const d = new Date(expiresAtMs);
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export function SessionBanner({ expiresAtMs }: Props) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  const remaining = expiresAtMs - now;
  const state = computeBannerState(remaining);
  if (state === 'expired') return null; // expiry is handled by the modal

  const colors = COLORS[state];
  let label: string;
  if (state === 'ok') {
    label = `Session expires at ${endTimeText(expiresAtMs)}`;
  } else if (state === 'warning') {
    label = `Session expires in ${formatHM(remaining)} — finish current match soon`;
  } else {
    label = `Session expires in ${formatHM(remaining)}. Ask the organizer to scan your QR again to extend.`;
  }

  return (
    <View style={[styles.banner, { backgroundColor: colors.bg }]}>
      <Text style={[styles.text, { color: colors.fg }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: { paddingVertical: 8, paddingHorizontal: 16 },
  text: { fontSize: 13, textAlign: 'center', fontWeight: '500' },
});
```

- [ ] **Step 2: Create `SessionExpiredModal.tsx`**

```tsx
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

interface Props {
  visible: boolean;
  reason: 'expired' | 'revoked';
  onGetNewQR: () => void;
}

export function SessionExpiredModal({ visible, reason, onGetNewQR }: Props) {
  const title =
    reason === 'expired'
      ? 'Your scoring session has ended.'
      : 'The organizer ended your session.';

  return (
    <Modal transparent visible={visible} animationType="fade">
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>{title}</Text>
          <Pressable style={styles.btn} onPress={onGetNewQR}>
            <Text style={styles.btnText}>Get new QR</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(2, 6, 23, 0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: '#0F172A',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    gap: 20,
    maxWidth: 380,
    width: '100%',
  },
  title: { color: '#F8FAFC', fontSize: 18, textAlign: 'center', fontWeight: '600' },
  btn: {
    backgroundColor: '#3B82F6',
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 10,
  },
  btnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
});
```

- [ ] **Step 3: Commit**

```bash
git add components/scorekeeper/SessionBanner.tsx components/scorekeeper/SessionExpiredModal.tsx
git commit -m "feat(scorekeeper): add SessionBanner and SessionExpiredModal"
```

---

## Task 13: Scorekeeper route guard layout

**Files:**
- Create: `app/(scorekeeper)/_layout.tsx`

- [ ] **Step 1: Write the layout**

Create `app/(scorekeeper)/_layout.tsx`:

```tsx
import { Slot, useRouter, useSegments } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { auth } from '@/lib/firebase';
import {
  isAccessActive,
  subscribeToOwnAccess,
  type ScorekeeperAccess,
} from '@/lib/scorekeeper-pairing';
import { SessionBanner } from '@/components/scorekeeper/SessionBanner';
import { SessionExpiredModal } from '@/components/scorekeeper/SessionExpiredModal';

/**
 * Wraps every screen under app/(scorekeeper)/. Subscribes to the access
 * doc for the current anonymous user and:
 *  - lets `/join/[tournamentId]` render unconditionally (it's the entry point)
 *  - redirects to `/join/[tournamentId]` if no active access on other screens
 *  - shows the SessionBanner on score-entry screens
 *  - shows SessionExpiredModal on revoke
 *
 * NOTE: This task lands the shell. The actual `tournamentId` source — a
 * Zustand slot set by the join + score-entry screens — is wired in Task 14.
 * Until then, `tournamentId` stays null and the subscription effect short-
 * circuits, so the screens render without route-guarding. Task 14 completes
 * the loop.
 */
export default function ScorekeeperLayout() {
  const router = useRouter();
  const segments = useSegments();
  const [tournamentId] = useState<string | null>(null); // replaced in Task 14
  const [access, setAccess] = useState<ScorekeeperAccess | null>(null);
  const [revoked, setRevoked] = useState(false);

  const onJoinScreen = segments.some((s) => s === 'join');

  useEffect(() => {
    if (!tournamentId) return;
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    let prevHadAccess = false;
    const unsub = subscribeToOwnAccess(tournamentId, uid, (next) => {
      if (prevHadAccess && !next) setRevoked(true);
      prevHadAccess = !!next;
      setAccess(next);
      if (!onJoinScreen && !isAccessActive(next)) {
        router.replace(`/(scorekeeper)/join/${tournamentId}`);
      }
    });
    return unsub;
  }, [tournamentId, onJoinScreen, router]);

  return (
    <View style={{ flex: 1, backgroundColor: '#0B1120' }}>
      {access && !onJoinScreen && (
        <SessionBanner expiresAtMs={access.expiresAt.toMillis()} />
      )}
      <Slot />
      <SessionExpiredModal
        visible={revoked}
        reason="revoked"
        onGetNewQR={() => {
          setRevoked(false);
          if (tournamentId) router.replace(`/(scorekeeper)/join/${tournamentId}`);
        }}
      />
    </View>
  );
}
```

> **Note for the implementer:** Task 14 replaces the `useState<string | null>(null)` line with a `useAppStore` selector reading from the Zustand slot it adds. Until that follow-up, this layout compiles, mounts, and short-circuits the subscription — the screens render fine but the layout doesn't yet route-guard.

- [ ] **Step 2: Commit**

```bash
git add app/\(scorekeeper\)/_layout.tsx
git commit -m "feat(scorekeeper): add route layout with banner + revoke modal scaffolding"
```

---

## Task 14: Replace Zustand session slot

**Files:**
- Modify: `store/app.store.ts`

- [ ] **Step 1: Replace contents of `store/app.store.ts`**

```ts
import { create } from 'zustand';

/**
 * Tracks which tournament the active scorekeeper screens belong to.
 * The actual access state lives in Firestore; this is just routing context
 * so the (scorekeeper) layout knows which access doc to subscribe to.
 */
type ScorekeeperContext = {
  tournamentId: string | null;
};

type AppState = {
  scorekeeperCtx: ScorekeeperContext;
  setScorekeeperTournament: (tournamentId: string | null) => void;
  clearScorekeeperContext: () => void;
};

export const useAppStore = create<AppState>((set) => ({
  scorekeeperCtx: { tournamentId: null },
  setScorekeeperTournament: (tournamentId) =>
    set({ scorekeeperCtx: { tournamentId } }),
  clearScorekeeperContext: () => set({ scorekeeperCtx: { tournamentId: null } }),
}));
```

- [ ] **Step 2: Update the layout from Task 13 to use the store**

In `app/(scorekeeper)/_layout.tsx`:

a. Add to top imports:

```tsx
import { useAppStore } from '@/store/app.store';
```

b. Replace the placeholder line

```tsx
const [tournamentId] = useState<string | null>(null); // replaced in Task 14
```

with

```tsx
const tournamentId = useAppStore((s) => s.scorekeeperCtx.tournamentId);
```

c. Remove the now-unused `useState` import if nothing else uses it (re-add `useEffect, useState` only as needed; `setAccess` and `setRevoked` still need `useState`).

d. Update the `useEffect` dependency array to reference the new `tournamentId` (already correct — it's already in the deps list from Task 13).

The subscription effect, render JSX, and revoke modal are unchanged from Task 13; only the source of `tournamentId` switches from `useState(null)` to the Zustand selector.

- [ ] **Step 3: Verify type-check**

Run: `npx tsc --noEmit`
Expected: errors only at the *old* PIN callsites in `enter/[matchId].tsx`, `new-tournament.tsx`, and `manage.tsx`. No new errors in the layout or store.

- [ ] **Step 4: Commit**

```bash
git add store/app.store.ts app/\(scorekeeper\)/_layout.tsx
git commit -m "feat(store): replace pin-bearing scorekeeper slot with tournamentId pointer"
```

---

## Task 15: Volunteer join screen

**Files:**
- Create: `app/(scorekeeper)/join/[tournamentId].tsx`

- [ ] **Step 1: Write the screen**

```tsx
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { PairingQR } from '@/components/scorekeeper/PairingQR';
import { auth } from '@/lib/firebase';
import { getTournamentById } from '@/lib/firestore/tournaments';
import {
  createPairingRequest,
  defaultDeviceLabel,
  deletePairingRequest,
  ensureAnonymousAuth,
  isAccessActive,
  subscribeToOwnAccess,
  type CreatePairingResult,
} from '@/lib/scorekeeper-pairing';
import { useAppStore } from '@/store/app.store';

type Phase =
  | 'loading-tournament'
  | 'tournament-not-found'
  | 'pick-device-label'
  | 'creating-pairing'
  | 'waiting-for-approval'
  | 'approved'
  | 'error';

export default function JoinScreen() {
  const { tournamentId } = useLocalSearchParams<{ tournamentId: string }>();
  const router = useRouter();
  const setScorekeeperTournament = useAppStore((s) => s.setScorekeeperTournament);

  const [phase, setPhase] = useState<Phase>('loading-tournament');
  const [tournamentName, setTournamentName] = useState('');
  const [label, setLabel] = useState(defaultDeviceLabel());
  const [pairing, setPairing] = useState<CreatePairingResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const accessUnsubRef = useRef<(() => void) | null>(null);

  // Load tournament + sign in anonymously
  useEffect(() => {
    if (!tournamentId) return;
    setScorekeeperTournament(tournamentId);

    (async () => {
      try {
        const t = await getTournamentById(tournamentId);
        if (!t) {
          setPhase('tournament-not-found');
          return;
        }
        setTournamentName(t.name);
        await ensureAnonymousAuth();
        setPhase('pick-device-label');
      } catch (e) {
        setErrorMsg(e instanceof Error ? e.message : 'Network error');
        setPhase('error');
      }
    })();
  }, [tournamentId, setScorekeeperTournament]);

  // Watch own access doc — flip to "approved" when it appears
  useEffect(() => {
    if (!tournamentId) return;
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    const unsub = subscribeToOwnAccess(tournamentId, uid, (access) => {
      if (isAccessActive(access)) {
        setPhase('approved');
        setTimeout(() => router.replace('/(scorekeeper)'), 1000);
      }
    });
    accessUnsubRef.current = unsub;
    return () => unsub();
  }, [tournamentId, router]);

  const startPairing = useCallback(async () => {
    if (!tournamentId) return;
    setPhase('creating-pairing');
    try {
      const result = await createPairingRequest(tournamentId, label.trim() || 'Device');
      setPairing(result);
      setPhase('waiting-for-approval');
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Could not create pairing request');
      setPhase('error');
    }
  }, [tournamentId, label]);

  const refreshQR = useCallback(async () => {
    if (pairing && tournamentId) {
      await deletePairingRequest(tournamentId, pairing.requestId).catch(() => undefined);
    }
    await startPairing();
  }, [pairing, tournamentId, startPairing]);

  if (phase === 'loading-tournament') {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#3B82F6" />
      </View>
    );
  }

  if (phase === 'tournament-not-found') {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>Tournament not found</Text>
        <Text style={styles.subtle}>Check the link or ask the organizer.</Text>
      </View>
    );
  }

  if (phase === 'error') {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>Something went wrong</Text>
        <Text style={styles.subtle}>{errorMsg}</Text>
        <Pressable style={styles.btn} onPress={startPairing}>
          <Text style={styles.btnText}>Try again</Text>
        </Pressable>
      </View>
    );
  }

  if (phase === 'pick-device-label') {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>Join {tournamentName}</Text>
        <Text style={styles.subtle}>What should we call this device?</Text>
        <TextInput
          value={label}
          onChangeText={setLabel}
          maxLength={40}
          style={styles.input}
          placeholder="Device label"
          placeholderTextColor="#475569"
        />
        <Pressable style={styles.btn} onPress={startPairing}>
          <Text style={styles.btnText}>Get pairing QR</Text>
        </Pressable>
      </View>
    );
  }

  if (phase === 'creating-pairing') {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#3B82F6" />
      </View>
    );
  }

  if (phase === 'approved') {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>Approved — opening scorekeeper…</Text>
      </View>
    );
  }

  // waiting-for-approval
  return (
    <View style={styles.center}>
      <Text style={styles.title}>Show this to the organizer</Text>
      <Text style={styles.subtle}>{tournamentName} · {label}</Text>
      {pairing && (
        <PairingQR
          payload={pairing.payload}
          expiresAtMs={pairing.expiresAtMs}
          onRefresh={refreshQR}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    backgroundColor: '#0B1120',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 16,
  },
  title: { color: '#F8FAFC', fontSize: 22, fontWeight: '700', textAlign: 'center' },
  subtle: { color: '#94A3B8', fontSize: 14, textAlign: 'center' },
  input: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#1E293B',
    color: '#F8FAFC',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    fontSize: 16,
  },
  btn: {
    backgroundColor: '#3B82F6',
    paddingVertical: 12,
    paddingHorizontal: 28,
    borderRadius: 8,
  },
  btnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
});
```

- [ ] **Step 2: Manually verify the screen renders (web)**

Run: `npm run web`
Visit: `http://localhost:8081/scorekeeper/join/<some-existing-tournament-id>`
Expected:
- "Join {tournament name}" appears
- "Get pairing QR" button → QR appears with countdown
- Refresh produces a new QR

- [ ] **Step 3: Commit**

```bash
git add app/\(scorekeeper\)/join/
git commit -m "feat(scorekeeper): add /join/[tournamentId] pairing screen"
```

---

## Task 16: Organizer-side `QRScannerModal`

**Files:**
- Create: `components/organizer/QRScannerModal.tsx`
- Modify: `package.json` (add `expo-camera`)

- [ ] **Step 1: Install dependency**

```bash
npx expo install expo-camera
```

(Using `expo install` instead of `npm install` so SDK 54-compatible version is picked.)

- [ ] **Step 2: Add camera permission to `app.json`**

In `app.json`, under `expo`, add (or merge into) a `plugins` array:

```json
"plugins": [
  ["expo-camera", { "cameraPermission": "Allow access to scan scorekeeper pairing QR codes." }]
]
```

- [ ] **Step 3: Write the modal**

```tsx
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useCallback, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { decodeQRPayload, type PairingQRPayload } from '@/lib/scorekeeper-pairing';

interface Props {
  visible: boolean;
  onClose: () => void;
  onScanned: (payload: PairingQRPayload) => void;
}

export function QRScannerModal({ visible, onClose, onScanned }: Props) {
  const [permission, requestPermission] = useCameraPermissions();
  const [error, setError] = useState<string | null>(null);
  const [handled, setHandled] = useState(false);

  const handleBarcode = useCallback(
    ({ data }: { data: string }) => {
      if (handled) return;
      const payload = decodeQRPayload(data);
      if (!payload) {
        setError('That QR is not a scorekeeper pairing code.');
        return;
      }
      setHandled(true);
      onScanned(payload);
    },
    [handled, onScanned],
  );

  // Reset handled state on each open
  if (!visible && handled) setHandled(false);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Scan scorekeeper QR</Text>
          <Pressable onPress={onClose}>
            <Text style={styles.close}>Close</Text>
          </Pressable>
        </View>

        {!permission ? (
          <View style={styles.center}><Text style={styles.body}>Loading…</Text></View>
        ) : !permission.granted ? (
          <View style={styles.center}>
            <Text style={styles.body}>Camera access is needed to scan the QR.</Text>
            <Pressable style={styles.btn} onPress={requestPermission}>
              <Text style={styles.btnText}>Grant camera access</Text>
            </Pressable>
          </View>
        ) : (
          <CameraView
            style={styles.camera}
            onBarcodeScanned={handleBarcode}
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          />
        )}

        {error && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{error}</Text>
            <Pressable onPress={() => setError(null)}>
              <Text style={styles.close}>Dismiss</Text>
            </Pressable>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B1120' },
  header: {
    paddingTop: 56,
    paddingHorizontal: 16,
    paddingBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: { color: '#F8FAFC', fontSize: 18, fontWeight: '700' },
  close: { color: '#3B82F6', fontSize: 15, fontWeight: '600' },
  camera: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 16 },
  body: { color: '#94A3B8', fontSize: 14, textAlign: 'center' },
  btn: { backgroundColor: '#3B82F6', paddingVertical: 12, paddingHorizontal: 28, borderRadius: 8 },
  btnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
  errorBanner: {
    backgroundColor: '#7F1D1D',
    paddingVertical: 10,
    paddingHorizontal: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  errorText: { color: '#FECACA', fontSize: 13, flex: 1 },
});
```

- [ ] **Step 4: Commit**

```bash
git add components/organizer/QRScannerModal.tsx app.json package.json package-lock.json
git commit -m "feat(organizer): add QRScannerModal using expo-camera"
```

---

## Task 17: Organizer pending + active scorekeepers cards

**Files:**
- Create: `components/organizer/PendingScorekeepersCard.tsx`
- Create: `components/organizer/ActiveScorekeepersList.tsx`

- [ ] **Step 1: Create `PendingScorekeepersCard.tsx`**

```tsx
import { useEffect, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { QRScannerModal } from '@/components/organizer/QRScannerModal';
import {
  approveScorekeeper,
  subscribeToPendingRequests,
} from '@/lib/firestore/scorekeeper-access';
import type { PairingRequest, PairingQRPayload } from '@/lib/scorekeeper-pairing';

interface Props {
  tournamentId: string;
}

function ageMins(req: PairingRequest): number {
  return Math.max(0, Math.floor((Date.now() - req.createdAt.toMillis()) / 60_000));
}

export function PendingScorekeepersCard({ tournamentId }: Props) {
  const [pending, setPending] = useState<PairingRequest[]>([]);
  const [scannerOpen, setScannerOpen] = useState(false);

  useEffect(
    () => subscribeToPendingRequests(tournamentId, setPending),
    [tournamentId],
  );

  const handleScanned = async (payload: PairingQRPayload) => {
    const result = await approveScorekeeper(payload, pending);
    setScannerOpen(false);
    if (!result.ok) {
      Alert.alert('Could not approve', result.reason);
    }
  };

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Pending scorekeepers</Text>
        <Pressable
          style={[styles.scanBtn, pending.length === 0 && styles.scanBtnDim]}
          onPress={() => setScannerOpen(true)}
        >
          <Text style={styles.scanBtnText}>Scan QR</Text>
        </Pressable>
      </View>
      {pending.length === 0 ? (
        <Text style={styles.empty}>No volunteers waiting for approval.</Text>
      ) : (
        <FlatList
          data={pending}
          keyExtractor={(r) => r.id}
          renderItem={({ item }) => (
            <View style={styles.row}>
              <Text style={styles.label}>{item.deviceLabel}</Text>
              <Text style={styles.meta}>{ageMins(item)} min ago</Text>
            </View>
          )}
          scrollEnabled={false}
        />
      )}
      <QRScannerModal
        visible={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScanned={handleScanned}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#0F172A', borderRadius: 12, padding: 16, gap: 12 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { color: '#F8FAFC', fontSize: 16, fontWeight: '700' },
  scanBtn: { backgroundColor: '#3B82F6', paddingVertical: 8, paddingHorizontal: 16, borderRadius: 8 },
  scanBtnDim: { opacity: 0.6 },
  scanBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
  empty: { color: '#64748B', fontSize: 13, fontStyle: 'italic' },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 },
  label: { color: '#F8FAFC', fontSize: 14 },
  meta: { color: '#94A3B8', fontSize: 12 },
});
```

- [ ] **Step 2: Create `ActiveScorekeepersList.tsx`**

```tsx
import { useEffect, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import {
  cleanupExpiredAccess,
  revokeScorekeeper,
  subscribeToActiveScorekeepers,
} from '@/lib/firestore/scorekeeper-access';
import type { ScorekeeperAccess } from '@/lib/scorekeeper-pairing';

interface Props {
  tournamentId: string;
}

function timeRemaining(expiresAtMs: number): string {
  const ms = Math.max(0, expiresAtMs - Date.now());
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export function ActiveScorekeepersList({ tournamentId }: Props) {
  const [rows, setRows] = useState<Array<ScorekeeperAccess & { uid: string }>>([]);

  useEffect(() => {
    cleanupExpiredAccess(tournamentId);
    return subscribeToActiveScorekeepers(tournamentId, setRows);
  }, [tournamentId]);

  const confirmRevoke = (uid: string, label: string) => {
    Alert.alert('Revoke access?', `End the scoring session for ${label}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Revoke',
        style: 'destructive',
        onPress: () => revokeScorekeeper(tournamentId, uid),
      },
    ]);
  };

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Active scorekeepers</Text>
      {rows.length === 0 ? (
        <Text style={styles.empty}>No one is currently scoring.</Text>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(r) => r.uid}
          scrollEnabled={false}
          renderItem={({ item }) => (
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>{item.deviceLabel}</Text>
                <Text style={styles.meta}>{timeRemaining(item.expiresAt.toMillis())} left</Text>
              </View>
              <Pressable
                style={styles.revokeBtn}
                onPress={() => confirmRevoke(item.uid, item.deviceLabel)}
              >
                <Text style={styles.revokeBtnText}>Revoke</Text>
              </Pressable>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#0F172A', borderRadius: 12, padding: 16, gap: 12 },
  title: { color: '#F8FAFC', fontSize: 16, fontWeight: '700' },
  empty: { color: '#64748B', fontSize: 13, fontStyle: 'italic' },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  label: { color: '#F8FAFC', fontSize: 14 },
  meta: { color: '#94A3B8', fontSize: 12, marginTop: 2 },
  revokeBtn: { backgroundColor: '#7F1D1D', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 6 },
  revokeBtnText: { color: '#FECACA', fontSize: 13, fontWeight: '600' },
});
```

- [ ] **Step 3: Commit**

```bash
git add components/organizer/PendingScorekeepersCard.tsx components/organizer/ActiveScorekeepersList.tsx
git commit -m "feat(organizer): add Pending and Active scorekeeper cards"
```

---

## Task 18: Wire cards into organizer manage page; remove PIN reveal

**Files:**
- Modify: `app/(organizer)/[id]/manage.tsx`

- [ ] **Step 1: Read the file to find the PIN reveal block**

Run: `grep -n 'venuePin\|revealPinValue\|pinInput' "app/(organizer)/[id]/manage.tsx"`
Note the line range that holds the PIN UI.

- [ ] **Step 2: Replace PIN-reveal section with new cards**

In `app/(organizer)/[id]/manage.tsx`:

a. Remove imports related to `getTournamentPrivateSettings` (from `@/lib/firestore/tournaments`) and the `venuePin` state.

b. Remove the `venuePin`-related JSX (between the section that includes `revealPinValue` and any associated PIN input handler).

c. Add imports near the top:

```tsx
import { PendingScorekeepersCard } from '@/components/organizer/PendingScorekeepersCard';
import { ActiveScorekeepersList } from '@/components/organizer/ActiveScorekeepersList';
```

d. Where the PIN section used to render, mount the two cards (assuming `tournament.id` is in scope):

```tsx
<PendingScorekeepersCard tournamentId={tournament.id} />
<ActiveScorekeepersList tournamentId={tournament.id} />
```

- [ ] **Step 3: Verify type-check + manual smoke**

Run: `npx tsc --noEmit`
Expected: errors only at `enter/[matchId].tsx` and `new-tournament.tsx` PIN callsites; manage.tsx is clean.

Run: `npm run web` and visit `/organizer/<tid>/manage`.
Expected: PIN section is gone; two new cards render; "No volunteers waiting" / "No one is currently scoring" empty-state copy shows.

- [ ] **Step 4: Commit**

```bash
git add app/\(organizer\)/\[id\]/manage.tsx
git commit -m "feat(organizer): replace PIN reveal with pending/active scorekeeper cards"
```

---

## Task 19: Remove PIN field from new-tournament form

**Files:**
- Modify: `app/(organizer)/new-tournament.tsx`

- [ ] **Step 1: Remove all PIN-related state, validation, JSX, and submit field**

In `app/(organizer)/new-tournament.tsx`:

a. Delete the line `const [venuePin, setVenuePin] = useState(randomPin());` (around line 49) and any helper `randomPin` if it's only used here.

b. Delete the `venuePin` slot from the `fieldErrors` state type (line 52) and the `nextFieldErrors` type (line 72).

c. Delete the validation block at lines 87-88 (the `/^\d{4}$/` check).

d. Remove `venuePin` from the create-input passed at line 117.

e. Delete the venuePin TextInput JSX (around lines 308-323).

- [ ] **Step 2: Verify type-check + manual smoke**

Run: `npx tsc --noEmit`
Expected: only the `enter/[matchId].tsx` PIN callsite remains.

Run: `npm run web`, visit `/organizer/new-tournament`.
Expected: form has no Venue PIN field; submission succeeds.

- [ ] **Step 3: Commit**

```bash
git add app/\(organizer\)/new-tournament.tsx
git commit -m "feat(organizer): drop venuePin field from new-tournament form"
```

---

## Task 20: Remove PIN flow from score-entry screen

**Files:**
- Modify: `app/(scorekeeper)/enter/[matchId].tsx`

- [ ] **Step 1: Remove PIN flow and wire up tournamentId pointer**

In `app/(scorekeeper)/enter/[matchId].tsx`:

a. Delete the import `import { activateScorekeeperSession } from '@/lib/scorekeeper-session';` (line 34).

b. Delete the call site at line 481 (`await activateScorekeeperSession(...)`) and the surrounding PIN-input modal markup. The route guard in `app/(scorekeeper)/_layout.tsx` (Task 13/14) now handles unapproved access by redirecting to the join screen.

c. Wherever the screen first knows `tournament.id`, set the pointer for the layout:

```tsx
import { useEffect } from 'react';
import { useAppStore } from '@/store/app.store';

// inside the component, after `tournament` is loaded:
const setScorekeeperTournament = useAppStore((s) => s.setScorekeeperTournament);
useEffect(() => {
  if (tournament?.id) setScorekeeperTournament(tournament.id);
}, [tournament?.id, setScorekeeperTournament]);
```

- [ ] **Step 2: Verify type-check**

Run: `npx tsc --noEmit`
Expected: zero errors. (PIN refactor complete.)

- [ ] **Step 3: Manual smoke — full pairing flow on web**

In two browser tabs:
1. Tab A (organizer, signed in): `/organizer/<tid>/manage` — see empty Pending card.
2. Tab B (incognito, fresh anon user): `/scorekeeper/join/<tid>` → enter device label → QR appears.
3. Tab A: Pending card now shows the request → tap **Scan QR** → in dev, you can manually call `approveScorekeeper(payload, pending)` from the console if camera isn't available; otherwise scan the QR shown in Tab B.
4. Tab B: auto-redirects to scorekeeper home; banner shows "Session expires at <next midnight>".
5. Tab A: Active card shows the new entry → tap Revoke.
6. Tab B: revoke modal pops; Get-new-QR returns to join.

- [ ] **Step 4: Commit**

```bash
git add app/\(scorekeeper\)/enter/\[matchId\].tsx
git commit -m "refactor(scorekeeper): remove inline PIN modal; rely on layout route guard"
```

---

## Task 21: Wrap score writes in a transaction (audit item #2)

**Files:**
- Modify: `lib/firestore/matches.ts`

- [ ] **Step 1: Replace `updateScore` with a transactional version**

In `lib/firestore/matches.ts`, replace the existing `updateScore` (lines 67-90) with:

```ts
import { runTransaction } from 'firebase/firestore';
// ... add to existing imports if not already present

export async function updateScore(
  tournamentId: string,
  matchId: string,
  gameIndex: number,
  updates: Partial<import('@/lib/firestore/types').ScoreGame>,
): Promise<void> {
  const matchRef = doc(db, 'tournaments', tournamentId, 'matches', matchId);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(matchRef);
    if (!snap.exists()) return;
    const match = snap.data() as MatchDocument;
    if (!match.scores[gameIndex]) return;
    const updatedScores = [...match.scores];
    updatedScores[gameIndex] = { ...updatedScores[gameIndex], ...updates };
    tx.update(matchRef, { scores: updatedScores, updatedAt: serverTimestamp() });
  });
}
```

- [ ] **Step 2: Replace `completeMatch` to batch the two writes**

Replace the `completeMatch` body (lines 92-142) with:

```ts
export async function completeMatch(
  tournamentId: string,
  matchId: string,
  winnerId: string,
  nextMatchId: string | null,
): Promise<void> {
  const matchRef = doc(db, 'tournaments', tournamentId, 'matches', matchId);
  const currentSnapshot = await getDoc(matchRef);
  const currentMatch = currentSnapshot.exists() ? (currentSnapshot.data() as MatchDocument) : null;
  const winnerName =
    currentMatch?.player1Id === winnerId ? currentMatch.player1Name
    : currentMatch?.player2Id === winnerId ? currentMatch.player2Name
    : 'TBD';

  const batch = writeBatch(db);
  batch.update(matchRef, {
    status: 'completed',
    winnerId,
    completedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  if (nextMatchId) {
    const nextRef = doc(db, 'tournaments', tournamentId, 'matches', nextMatchId);
    const nextSnapshot = await getDoc(nextRef);
    if (nextSnapshot.exists()) {
      const nextMatch = nextSnapshot.data() as MatchDocument;
      const player1Open = !nextMatch.player1Id || nextMatch.player1Id === 'TBD';
      const player2Open = !nextMatch.player2Id || nextMatch.player2Id === 'TBD';

      if (player1Open || nextMatch.player1Id === winnerId) {
        batch.update(nextRef, {
          player1Id: winnerId,
          player1Name: winnerName,
          updatedAt: serverTimestamp(),
        });
      } else if (player2Open || nextMatch.player2Id === winnerId) {
        batch.update(nextRef, {
          player2Id: winnerId,
          player2Name: winnerName,
          updatedAt: serverTimestamp(),
        });
      }
    }
  }

  await batch.commit();
}
```

- [ ] **Step 3: Verify type-check**

Run: `npx tsc --noEmit`
Expected: zero errors.

- [ ] **Step 4: Manual smoke — score a match end-to-end**

Open the app, score a match, complete it.
Expected: scores update without errors; bracket advances correctly.

- [ ] **Step 5: Commit**

```bash
git add lib/firestore/matches.ts
git commit -m "fix(matches): wrap updateScore in runTransaction; batch completeMatch writes

Closes audit item #2: prior code did getDoc → mutate → updateDoc with no
transaction, allowing concurrent score writes to silently overwrite each
other. Bracket advancement also batched so partial failure can't corrupt
the next-match references."
```

---

## Task 22: Delete the dead PIN code

**Files:**
- Delete: `lib/scorekeeper-session.ts`
- Modify: `lib/firestore/tournaments.ts`
- Modify: `lib/firestore/types.ts`

- [ ] **Step 1: Delete the file**

Run: `rm "lib/scorekeeper-session.ts"`

- [ ] **Step 2: Strip PIN-writing from `createTournament` and remove dead exports**

In `lib/firestore/tournaments.ts`:

a. In `createTournament` (currently lines 26-47), drop the destructure `const { venuePin, ...tournamentData } = input;` — the input no longer has `venuePin`. Also delete the `setDoc(doc(db, 'tournaments', newRef.id, 'private', 'settings'), ...)` block.

The new function body:

```ts
export async function createTournament(
  input: CreateTournamentInput,
): Promise<string> {
  const newRef = doc(tournamentsRef);
  const now = serverTimestamp();

  await setDoc(newRef, {
    ...input,
    id: newRef.id,
    status: 'draft',
    publicViewEnabled: input.publicViewEnabled ?? false,
    createdAt: now,
    updatedAt: now,
  });

  return newRef.id;
}
```

b. Remove the `getTournamentPrivateSettings`, `validateScorekeeperAccess`, and `grantScorekeeperAccess` exports (currently lines 138-172). Also remove the `revokeScorekeeperAccess` export from this file — its replacement lives in `lib/firestore/scorekeeper-access.ts`.

c. Remove the now-unused `TournamentPrivateSettings` import.

- [ ] **Step 3: Delete the deprecated marker type**

In `lib/firestore/types.ts`, delete the `TournamentPrivateSettings` interface (the deprecated empty marker added in Task 4).

- [ ] **Step 4: Verify type-check + tests**

Run: `npx tsc --noEmit && npm test`
Expected: zero errors; all unit tests pass.

- [ ] **Step 5: Commit**

```bash
git add -u lib/scorekeeper-session.ts lib/firestore/tournaments.ts lib/firestore/types.ts
git commit -m "refactor: delete PIN-flow dead code

Removes lib/scorekeeper-session.ts entirely, drops PIN write from
createTournament, removes getTournamentPrivateSettings, grantScorekeeperAccess,
validateScorekeeperAccess, and revokeScorekeeperAccess (the latter replaced
by lib/firestore/scorekeeper-access.ts)."
```

---

## Task 23: Migration script for existing data

**Files:**
- Create: `scripts/migrate-remove-pin-system.ts`

- [ ] **Step 1: Write the script**

Create `scripts/migrate-remove-pin-system.ts`:

```ts
/**
 * One-shot cleanup of pre-launch tournaments. Run by the organizer using
 * their own auth (no Admin SDK) — works under the new firestore.rules.
 *
 * Usage:
 *   EXPO_PUBLIC_FIREBASE_* env vars set (same as the app)
 *   ORGANIZER_EMAIL=… ORGANIZER_PASSWORD=… npx tsx scripts/migrate-remove-pin-system.ts
 *
 * What it does (per tournament owned by the signed-in organizer):
 *   1. Deletes every doc in `tournaments/{tid}/scorekeeperAccess`.
 *   2. Deletes `tournaments/{tid}/private/settings`.
 */

import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  getFirestore,
  query,
  where,
  writeBatch,
} from 'firebase/firestore';

async function main() {
  const email = process.env.ORGANIZER_EMAIL;
  const password = process.env.ORGANIZER_PASSWORD;
  if (!email || !password) {
    console.error('Set ORGANIZER_EMAIL and ORGANIZER_PASSWORD env vars.');
    process.exit(1);
  }

  const app = initializeApp({
    apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY!,
    authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN!,
    projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID!,
    appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID!,
  });
  const auth = getAuth(app);
  const db = getFirestore(app);

  const cred = await signInWithEmailAndPassword(auth, email, password);
  console.log('Signed in as', cred.user.uid);

  const tournaments = await getDocs(
    query(collection(db, 'tournaments'), where('organizerId', '==', cred.user.uid)),
  );
  console.log(`Found ${tournaments.size} tournaments owned by ${cred.user.uid}`);

  for (const t of tournaments.docs) {
    const tid = t.id;
    console.log(`\n— ${tid} (${t.data().name ?? '?'})`);

    // Delete all scorekeeperAccess docs
    const accesses = await getDocs(collection(db, 'tournaments', tid, 'scorekeeperAccess'));
    if (!accesses.empty) {
      const batch = writeBatch(db);
      accesses.docs.forEach((d) => batch.delete(d.ref));
      await batch.commit();
      console.log(`  deleted ${accesses.size} scorekeeperAccess docs`);
    }

    // Delete private/settings if present
    try {
      await deleteDoc(doc(db, 'tournaments', tid, 'private', 'settings'));
      console.log('  deleted private/settings');
    } catch {
      // already gone
    }
  }

  console.log('\nDone.');
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
```

- [ ] **Step 2: Add npm script**

In `package.json` `scripts`, add:

```json
"migrate:remove-pin": "tsx scripts/migrate-remove-pin-system.ts"
```

- [ ] **Step 3: Commit (do NOT run yet — this touches real data)**

```bash
git add scripts/migrate-remove-pin-system.ts package.json
git commit -m "chore: add one-shot migration to clean up legacy PIN docs"
```

The user runs this manually with `ORGANIZER_EMAIL=… ORGANIZER_PASSWORD=… npm run migrate:remove-pin` after deploying the new rules.

---

## Task 24: Final verification — full test suite + manual checklist

- [ ] **Step 1: Run all automated tests**

Run: `npx firebase emulators:exec --only firestore "jest"`
Expected: all tests pass (rules tests + unit tests).

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: zero errors.

- [ ] **Step 3: Run the app on web and walk the smoke checklist**

Run: `npm run web`

Manual checklist:
- [ ] Volunteer pairing — happy path (Tab A organizer, Tab B incognito volunteer)
- [ ] Volunteer refresh QR while pending creates a new request and removes the old
- [ ] Organizer revoke shows the revoke modal on the volunteer side immediately
- [ ] Volunteer's banner updates colors as it crosses 30-min and 5-min thresholds (test with a temporarily shorter session by editing `nextMidnight()` to return `Date.now() + 6 * 60 * 1000` for verification — revert before commit)
- [ ] Score-entry on a fresh device redirects to the join screen
- [ ] Tournament without `publicViewEnabled` does not allow public read (verify via Firestore console or a logged-out tab)
- [ ] Existing organizer flows (create tournament, manage matches, complete match, bracket advance) still work

- [ ] **Step 4: Deploy rules to Firebase**

Run: `npx firebase deploy --only firestore:rules`
Expected: deployment succeeds; the new rules are live.

- [ ] **Step 5: (Optional) Run the data migration**

Only after rules deploy:

```bash
ORGANIZER_EMAIL=… ORGANIZER_PASSWORD=… npm run migrate:remove-pin
```

- [ ] **Step 6: Final commit + PR**

If anything was tweaked during smoke testing:

```bash
git add -u
git commit -m "chore: smoke-test polish for scorekeeper-pairing rollout"
```

Then open a PR against `master`.

---

## Self-Review Notes

**Spec coverage check:**

| Spec section | Tasks |
|---|---|
| Goal: close bypass | Tasks 5 (rules) + 7 (rules tests) |
| Goal: per-device QR pairing | Tasks 8, 11, 15 |
| Goal: organizer visibility + revoke | Tasks 9, 17, 18 |
| Goal: end-of-day expiry | Tasks 3 + 9 + 12 |
| Goal: ship without Cloud Functions | Whole approach (rules-only) |
| Goal: surface separation | Task 13 (separate `(scorekeeper)` layout, no shared layout with `(watch)` or `tv`) |
| Data model: pairingRequests | Tasks 4 (types) + 5 (rules) + 8 (write) |
| Data model: scorekeeperAccess (new shape) | Tasks 4 + 5 + 9 |
| Removed: private/settings | Task 22 (createTournament stops writing) + Task 23 (migration) |
| Components | Tasks 11, 12, 13, 16, 17 |
| Library code | Tasks 8, 9 |
| Migration | Task 23 |
| Testing strategy | Tasks 2, 3, 7, 10 + manual smoke in 24 |
| Score transaction (audit #2) | Task 21 |
| UX banner states | Tasks 10 + 12 |
| Edge cases (nonce mismatch, expired QR, revoke, expiry) | Task 9 (`approveScorekeeper` returns) + Task 13/14 (revoke modal) + Task 15 (refresh) |

No gaps detected.
