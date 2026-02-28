import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore';

import { db } from '@/lib/firebase';
import {
  type CreateMatchInput,
  type MatchDocument,
  type MatchRound,
  type MatchStatus,
} from '@/lib/firestore/types';

function matchesRef(tournamentId: string) {
  return collection(db, 'tournaments', tournamentId, 'matches');
}

export async function addMatch(tournamentId: string, input: CreateMatchInput): Promise<string> {
  const created = await addDoc(matchesRef(tournamentId), {
    ...input,
    groupId: input.groupId ?? null,
    courtNumber: input.courtNumber ?? null,
    scheduledTime: input.scheduledTime ?? null,
    status: input.status ?? 'scheduled',
    scores: input.scores ?? [],
    winnerId: input.winnerId ?? null,
    scorekeeperId: input.scorekeeperId ?? null,
    startedAt: input.startedAt ?? null,
    completedAt: input.completedAt ?? null,
    nextMatchId: input.nextMatchId ?? null,
  });

  await updateDoc(doc(db, 'tournaments', tournamentId, 'matches', created.id), { id: created.id });
  return created.id;
}

export async function updateMatch(
  tournamentId: string,
  matchId: string,
  patch: Partial<Omit<MatchDocument, 'id'>>,
): Promise<void> {
  await updateDoc(doc(db, 'tournaments', tournamentId, 'matches', matchId), patch);
}

export async function updateMatchStatus(
  tournamentId: string,
  matchId: string,
  status: MatchStatus,
): Promise<void> {
  await updateDoc(doc(db, 'tournaments', tournamentId, 'matches', matchId), {
    status,
    updatedAt: serverTimestamp(),
  });
}

export async function updateScore(
  tournamentId: string,
  matchId: string,
  gameIndex: number,
  updates: Partial<import('@/lib/firestore/types').ScoreGame>,
): Promise<void> {
  const matchRef = doc(db, 'tournaments', tournamentId, 'matches', matchId);
  const snapshot = await getDoc(matchRef);
  if (!snapshot.exists()) return;

  const match = snapshot.data() as MatchDocument;
  const updatedScores = [...match.scores];
  if (!updatedScores[gameIndex]) return;

  updatedScores[gameIndex] = {
    ...updatedScores[gameIndex],
    ...updates,
  };

  await updateDoc(matchRef, {
    scores: updatedScores,
    updatedAt: serverTimestamp(),
  });
}

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
    currentMatch?.player1Id === winnerId
      ? currentMatch.player1Name
      : currentMatch?.player2Id === winnerId
        ? currentMatch.player2Name
        : 'TBD';

  await updateDoc(matchRef, {
    status: 'completed',
    winnerId,
    completedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  // MVP default: write winner into player1 slot of next knockout match.
  if (nextMatchId) {
    const nextRef = doc(db, 'tournaments', tournamentId, 'matches', nextMatchId);
    const nextSnapshot = await getDoc(nextRef);
    if (!nextSnapshot.exists()) return;

    const nextMatch = nextSnapshot.data() as MatchDocument;
    const player1Open = !nextMatch.player1Id || nextMatch.player1Id === 'TBD';
    const player2Open = !nextMatch.player2Id || nextMatch.player2Id === 'TBD';

    if (player1Open || nextMatch.player1Id === winnerId) {
      await updateDoc(nextRef, {
        player1Id: winnerId,
        player1Name: winnerName,
        updatedAt: serverTimestamp(),
      });
      return;
    }

    if (player2Open || nextMatch.player2Id === winnerId) {
      await updateDoc(nextRef, {
        player2Id: winnerId,
        player2Name: winnerName,
        updatedAt: serverTimestamp(),
      });
    }
  }
}

const BATCH_LIMIT = 500;

async function batchDeleteDocs(docs: Array<{ ref: import('firebase/firestore').DocumentReference }>): Promise<void> {
  for (let i = 0; i < docs.length; i += BATCH_LIMIT) {
    const chunk = docs.slice(i, i + BATCH_LIMIT);
    const batch = writeBatch(db);
    chunk.forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }
}

export async function deleteAllMatches(tournamentId: string): Promise<void> {
  const snapshot = await getDocs(matchesRef(tournamentId));
  if (snapshot.empty) return;
  await batchDeleteDocs(snapshot.docs);
}

const KNOCKOUT_ROUNDS: MatchRound[] = ['R16', 'QF', 'SF', 'F', '3rd'];

export async function deleteKnockoutMatches(tournamentId: string): Promise<void> {
  const knockoutQuery = query(matchesRef(tournamentId), where('round', 'in', KNOCKOUT_ROUNDS));
  const snapshot = await getDocs(knockoutQuery);
  if (snapshot.empty) return;
  await batchDeleteDocs(snapshot.docs);
}

export function subscribeToMatches(
  tournamentId: string,
  onData: (matches: MatchDocument[]) => void,
  onError?: (message: string) => void,
): Unsubscribe {
  const q = query(matchesRef(tournamentId), orderBy('scheduledTime', 'asc'));
  return onSnapshot(
    q,
    (snapshot) => onData(snapshot.docs.map((d) => d.data() as MatchDocument)),
    (error) => onError?.(error.message),
  );
}

export function subscribeToLiveMatches(
  tournamentId: string,
  onData: (matches: MatchDocument[]) => void,
  onError?: (message: string) => void,
): Unsubscribe {
  const q = query(matchesRef(tournamentId), where('status', '==', 'live'));
  return onSnapshot(
    q,
    (snapshot) => onData(snapshot.docs.map((d) => d.data() as MatchDocument)),
    (error) => onError?.(error.message),
  );
}

export function subscribeToMatch(
  tournamentId: string,
  matchId: string,
  onData: (match: MatchDocument | null) => void,
  onError?: (message: string) => void,
): Unsubscribe {
  const ref = doc(db, 'tournaments', tournamentId, 'matches', matchId);
  return onSnapshot(
    ref,
    (snapshot) => onData(snapshot.exists() ? (snapshot.data() as MatchDocument) : null),
    (error) => onError?.(error.message),
  );
}
