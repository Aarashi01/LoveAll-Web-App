# Scorekeeper QR-Pairing Auth — Design

**Date:** 2026-05-03
**Author:** Vignesh + Claude
**Status:** Approved, ready for implementation plan
**Replaces:** Existing PIN-based scorekeeper validation

---

## Problem

The current scorekeeper auth flow has a security bypass and poor UX.

**The bypass.** `firestore.rules:38-46` allows any authenticated user to write `tournaments/{tid}/scorekeeperAccess/{theirOwnUid}` with `{validated: true, tournamentId, validatedAt}`. There is no PIN check, organizer check, or server-side verification in the rule. Attack: `signInAnonymously()` → write the doc → gain full read/write on all matches in any tournament.

The PIN itself is also stored in plaintext in `tournaments/{tid}/private/settings.venuePin` and is validated *client-side* in `lib/scorekeeper-session.ts:16` by reading the doc and comparing strings — making the rule the only line of defense, and that line is broken.

**The UX problems.** Sharing a single PIN across the venue is awkward (yelling digits across a court), the PIN never expires, the organizer has no visibility into who is currently scoring, and there is no per-device control or revoke.

**Constraint.** The project is on Firebase Spark (free) plan — no Cloud Functions available.

## Goals

1. Eliminate the rules bypass — only the organizer can grant scorekeeper access.
2. Replace the shared PIN with a per-device pairing flow that maps to how real tournaments operate.
3. Give the organizer live visibility and one-tap revoke for every active scorekeeper.
4. Auto-expire access at end-of-day so a forgotten device cannot score the next morning.
5. Ship without Cloud Functions and without paid Firebase tier.
6. Keep the score-entry, public-watch, and TV-display surfaces strictly separate (no shared layout, no shared entry point).

## Non-goals

- Per-court or per-match scoping — every approved scorekeeper is tournament-wide for v1. Court scoping is a possible follow-up.
- Cloud Function-based PIN validation — explicitly off the table on Spark.
- Server-side scheduled cleanup of expired docs — opportunistic client cleanup is sufficient.
- Per-tournament timezone configuration — default to organizer's device timezone, document the limitation.
- Rate limiting on pairing-request creation — low risk on Spark; revisit only if abused.
- Migration of any *production* data — this is pre-launch; cleanup script is for dev convenience.

## Approach

A **QR-pairing** flow modeled on AirPlay / YouTube-on-TV pairing:

1. Volunteer opens `/scorekeeper/join/{tournamentId}` on their phone.
2. App signs them in anonymously, generates a 32-byte nonce, writes a short-lived `pairingRequest` doc, and renders a QR encoding `{tournamentId, scorekeeperUid, nonce}`.
3. Organizer (already authenticated) scans the QR from their dashboard. The organizer's app verifies the nonce matches the pending request, then writes a `scorekeeperAccess` doc for that UID with an `expiresAt` of next-midnight in the organizer's timezone.
4. Volunteer's listener fires; they auto-redirect into score entry.
5. Firestore rules now require: only `isOrganizer(tid)` can write `scorekeeperAccess`, and access is gated by `access.expiresAt > request.time` evaluated server-side.

**Direction of scan** is deliberately *volunteer shows, organizer scans*. This ensures the only Firestore write that grants access comes from the authenticated organizer; a leaked screenshot of a QR is useless to a third party.

## Data model

### `tournaments/{tournamentId}/pairingRequests/{requestId}`

Short-lived "I want to score" flares from volunteers.

| Field | Type | Notes |
|---|---|---|
| `scorekeeperUid` | string | Volunteer's anonymous Firebase UID |
| `nonce` | string | Random 32-byte hex (64 chars). Encoded into the QR |
| `deviceLabel` | string | e.g. "iPhone 14", ≤64 chars. Helps organizer pick the right one |
| `createdAt` | timestamp | `serverTimestamp()` |
| `expiresAt` | timestamp | `createdAt + 5 min` (rule caps at 10 min) |

Lifecycle: created by volunteer → read by organizer → deleted by organizer after approval (or by volunteer when refreshing QR).

### `tournaments/{tournamentId}/scorekeeperAccess/{scorekeeperUid}`

Replaces the existing collection with the same name. No `validated` boolean — *existence + non-expired* = access.

| Field | Type | Notes |
|---|---|---|
| `tournamentId` | string | Redundant but checked in rules |
| `approvedAt` | timestamp | `serverTimestamp()` |
| `approvedBy` | string | Organizer's UID (audit trail) |
| `expiresAt` | timestamp | Next midnight in organizer's timezone, capped at +24h by rule |
| `deviceLabel` | string | Carried over from pairing request |

### Removed

- `tournaments/{tournamentId}/private/settings` — held the plaintext `venuePin`. Subcollection deleted entirely.
- Any `venuePin`-related fields on the tournament root doc.

## Surfaces

Each in its own route group; no shared layout.

| Surface | Path | Audience | Auth |
|---|---|---|---|
| Score-entry | `app/(scorekeeper)/` | Approved volunteers | Anonymous + valid `scorekeeperAccess` doc |
| Join (pairing) | `app/(scorekeeper)/join/[tournamentId].tsx` | Volunteers about to be approved | Anonymous |
| Public viewer | `app/(watch)/[slug]` | Anyone with the link | None (rules check `publicViewEnabled`) |
| TV display | `app/tv/` | Big screens at venue | None |
| Organizer dashboard | `app/(organizer)/` | Organizer only | Email/password (existing) |

The watch and TV surfaces never share a layout, route group, or entry point with score-entry.

## Components

**New**

- `app/(scorekeeper)/join/[tournamentId].tsx` — entry point: anonymous sign-in, QR display, status messaging
- `components/scorekeeper/PairingQR.tsx` — renders QR + countdown to QR expiry, refresh button
- `components/scorekeeper/SessionBanner.tsx` — persistent banner on score-entry screens with countdown to `expiresAt`
- `components/scorekeeper/SessionExpiredModal.tsx` — full-screen interruption when access expires or is revoked
- `components/organizer/PendingScorekeepersCard.tsx` — live list of `pairingRequests` with "Scan QR" CTA
- `components/organizer/QRScannerModal.tsx` — uses `expo-camera` to scan
- `components/organizer/ActiveScorekeepersList.tsx` — live list of `scorekeeperAccess` with revoke button

**New library code**

- `lib/scorekeeper-pairing.ts` — `createPairingRequest()`, `subscribeToOwnAccess()`, `refreshPairingRequest()`, nonce generator
- `lib/firestore/scorekeeper-access.ts` — `approveScorekeeper()`, `revokeScorekeeper()`, `subscribeToPendingRequests()`, `subscribeToActiveScorekeepers()`, `cleanupExpiredAccess()`
- `lib/end-of-day.ts` — pure helper returning next-midnight timestamp in device timezone

**Removed / deleted**

- `lib/scorekeeper-session.ts` — entire PIN flow
- `getTournamentPrivateSettings`, `grantScorekeeperAccess` exports from `lib/firestore/tournaments.ts`
- PIN entry screen wherever it currently renders
- `setScorekeeperSession(pin, tournamentId)` slot in Zustand `app.store`

**New dependencies**

- `react-native-qrcode-svg` — render QR on volunteer side (~5KB)
- `expo-camera` — scan QR on organizer side (first-party Expo, web-supported)

## Flows

### Flow A — Volunteer joins (happy path)

```
Volunteer                        Firestore                       Organizer
─────────                        ─────────                       ─────────
Opens /scorekeeper/join/abc
  ↓
signInAnonymously()        ──→   creates auth user (uid=V1)
  ↓
createPairingRequest({
  scorekeeperUid: V1,
  nonce: <random-32B>,
  deviceLabel: "Pixel 8",
  expiresAt: now + 5min
})                         ──→   tournaments/abc/pairingRequests/{auto}
  ↓
Renders QR encoding:
  { tid: "abc",
    uid: "V1",
    nonce: "<random-32B>" }
  ↓
Subscribes to                                                    ↓
  scorekeeperAccess/V1     ←──   waits…                      sees pending request
                                                                  ↓
                                                             taps "Scan QR"
                                                                  ↓
                                                             scans, decodes payload
                                                                  ↓
                                                             validates:
                                                               - nonce matches
                                                                 the pending doc
                                                               - request not expired
                                                                  ↓
                                 writes scorekeeperAccess/V1 ←── approveScorekeeper()
                                   { tournamentId, approvedAt,
                                     approvedBy, expiresAt:
                                     midnight, deviceLabel }
                                 deletes pairingRequest      ←── cleanup
  ↓
Listener fires → access doc
exists & not expired
  ↓
Auto-redirect to
/scorekeeper/matches
```

### Flow B — Scoring (post-approval)

1. Every score-entry mount subscribes to `scorekeeperAccess/{myUid}`.
2. Doc missing → "You no longer have access" → modal → redirect to join.
3. `expiresAt < now` → "Session expired" → modal → redirect to join.
4. Otherwise render score-entry. `SessionBanner` runs a 30s interval to update countdown.
5. Score writes go through `runTransaction()` so concurrent edits don't lose data. *(This wraps work from audit item #2 into the same milestone.)*

### Flow C — Organizer revokes mid-session

1. Organizer taps revoke in `ActiveScorekeepersList` → deletes the access doc.
2. Volunteer's listener fires → "The organizer ended your session" modal → button to re-join.
3. Any in-flight write fails the rule check → caught client-side → "Session ended, score not saved" toast.

### Flow D — End-of-day expiry

1. Volunteer's `SessionBanner` countdown hits 0 → UI flips to expired state.
2. Next score write would fail the rule (rule re-checks `expiresAt > request.time`).
3. Old `scorekeeperAccess` docs with `expiresAt < now` are cleaned up opportunistically by the organizer's dashboard whenever it loads (cheap query, batched delete). No scheduled function needed.

### Edge cases

| Case | Behavior |
|---|---|
| Organizer doesn't approve in 5 min | QR doc auto-expires; volunteer screen offers Refresh |
| Volunteer's anonymous UID is recycled | Anonymous UIDs are stable per device until storage cleared; if cleared, they re-pair (acceptable) |
| Organizer scans an old QR after volunteer refreshed | Nonce won't match current pairing request → "QR no longer valid, ask volunteer to refresh" |
| Tournament ends mid-session | Access doc lookup gracefully fails next write |
| Volunteer's clock is wrong | Rules trust **server** time (`request.time`), not client clock |
| Time zone of "end of day" | Computed from organizer's device tz at approval time. Documented limitation; per-tournament tz is a future feature |

## Firestore rules

Full file replacement. Summary of key changes:

- `pairingRequests/{requestId}` — new subcollection. Volunteer can create their own (with shape + TTL validation), nobody can update, volunteer or organizer can delete. Hard cap of 10 minutes on `expiresAt` enforced in the rule.
- `scorekeeperAccess/{scorekeeperUid}` — bypass closed. Only `isOrganizer(tournamentId)` may create/update/delete. Validates `tournamentId`, `approvedBy == request.auth.uid`, and `expiresAt` within (now, now+24h].
- `isActiveScorekeeper(tournamentId)` — replaces `isValidatedScorekeeper`. Definition becomes "access doc exists AND `expiresAt > request.time`". No `validated` field anywhere.
- `matches/{matchId}` — scorekeepers can only **update** existing matches. Create and delete remain organizer-only.
- `private/settings` subcollection — deleted along with the PIN it held.

Full rule file to apply verbatim:

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

## UX details

### Session banner states

Computed every 30 seconds.

| Time remaining | Visual | Copy |
|---|---|---|
| > 30 min | Subtle gray | `Session expires at 11:59 PM` |
| 5–30 min | Amber | `Session expires in 24 min — finish current match soon` |
| < 5 min | Red, sticky | `Session expires in 4:32. Ask the organizer to scan your QR again to extend.` |
| 0 / expired | Full-screen modal | `Your scoring session has ended.` + **Get new QR** button |
| Revoked | Full-screen modal | `The organizer ended your session.` + **Get new QR** button |

A modal at expiry/revoke (not just a banner) is deliberate — a volunteer mid-tap should not silently lose writes.

### Join screen states

`loading-tournament` → `signing-in` → `creating-pairing` → `waiting-for-approval` (QR + 5 min countdown) → `approved` (auto-redirect after 1s) → `qr-expired` (Refresh button → recreates pairing request).

Error states: `tournament-not-found`, `tournament-ended`, `network-error` — each with a clear message and retry action.

Device label is pre-filled from `Platform.OS` + screen size heuristics ("iPhone", "Android phone", "Web browser") and editable before generating the QR.

### Organizer dashboard additions

Two new cards on the manage page:

1. **Pending scorekeepers** — live list of `pairingRequests`. Row = device label + age. Primary CTA: **Scan QR** (opens camera modal). Secondary: dismiss.
2. **Active scorekeepers** — live list of `scorekeeperAccess` sorted by `expiresAt`. Row = device label + time remaining + **Revoke** button.

Both use the same listener pattern as existing dashboard data.

## Migration

This is pre-launch, so cleanup is one-shot.

1. Delete all `tournaments/{*}/scorekeeperAccess/{*}` docs. The old shape (`{validated, validatedAt, tournamentId}`) lacks `expiresAt`, so the new rule's `access.data.expiresAt > request.time` check would fail anyway — but cleanup avoids confusing leftovers in the console.
2. Delete `tournaments/{*}/private/settings` documents.
3. Drop any `venuePin`-related fields on tournament root docs.
4. Remove unused exports from `lib/firestore/tournaments.ts` (`getTournamentPrivateSettings`, `grantScorekeeperAccess`).
5. Remove the PIN/`tournamentId` slots from Zustand `app.store` — the access doc is the new source of truth.

A `scripts/migrate-remove-pin-system.ts` runnable via `npx tsx`, executed by the organizer using their own auth (no Admin SDK needed).

## Testing strategy

**Tier 1 — Pure-function unit tests** (Jest, no Firebase)
- `lib/end-of-day.ts` across DST boundaries, around midnight, in different time zones
- Nonce generator: length, character set, uniqueness over 10k samples
- Banner state machine: time-remaining → state mapping

**Tier 2 — Firestore rules tests** (`@firebase/rules-unit-testing`, runs against the local emulator — free, no Spark constraint)
- Volunteer cannot write their own `scorekeeperAccess` (the bypass we are closing)
- Volunteer can create a `pairingRequest` for themselves only, not for someone else
- Organizer can approve and revoke
- Expired access doc → match update denied
- Non-active scorekeeper → match update denied
- Public viewer can read matches when `publicViewEnabled`, denied otherwise

**Tier 3 — Manual smoke checklist** (no E2E framework — too heavy for this phase)
- Pair via QR end-to-end on web (two browser tabs)
- Mid-session revoke shows modal
- Expired session shows modal + recovery
- Refresh QR while pending works
- Existing organizer flows untouched

The rules tests are highest leverage — they directly verify the bypass is closed.

## Open questions / future work

- Per-court scoping for multi-court events (would change the approval modal and tighten the rule on `matches`)
- Per-tournament timezone field for venues that span midnight oddly
- QR rotation on the organizer side as an alternative direction (currently volunteer-shows / organizer-scans is the chosen direction for security)
- Rate limiting on `pairingRequest` creation if abuse appears
