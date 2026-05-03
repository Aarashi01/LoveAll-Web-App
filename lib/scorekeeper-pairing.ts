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

export type { PairingRequest, PairingQRPayload, ScorekeeperAccess };
