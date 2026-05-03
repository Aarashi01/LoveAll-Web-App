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
