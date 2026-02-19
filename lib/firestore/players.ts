import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  type Unsubscribe,
} from 'firebase/firestore';

import { db } from '@/lib/firebase';
import { type CreatePlayerInput, type PlayerDocument } from '@/lib/firestore/types';

function playersRef(tournamentId: string) {
  return collection(db, 'tournaments', tournamentId, 'players');
}

export async function addPlayer(tournamentId: string, input: CreatePlayerInput): Promise<string> {
  const created = await addDoc(playersRef(tournamentId), {
    ...input,
    partnerId: input.partnerId ?? null,
    groupId: input.groupId ?? null,
    seeded: input.seeded ?? false,
    addedAt: serverTimestamp(),
  });

  await updateDoc(doc(db, 'tournaments', tournamentId, 'players', created.id), { id: created.id });
  return created.id;
}

export async function updatePlayer(
  tournamentId: string,
  playerId: string,
  patch: Partial<Omit<PlayerDocument, 'id' | 'addedAt'>>,
): Promise<void> {
  await updateDoc(doc(db, 'tournaments', tournamentId, 'players', playerId), patch);
}

export async function deletePlayer(tournamentId: string, playerId: string): Promise<void> {
  await deleteDoc(doc(db, 'tournaments', tournamentId, 'players', playerId));
}

export function subscribeToPlayers(
  tournamentId: string,
  onData: (players: PlayerDocument[]) => void,
): Unsubscribe {
  const q = query(playersRef(tournamentId), orderBy('addedAt', 'asc'));
  return onSnapshot(q, (snapshot) => onData(snapshot.docs.map((d) => d.data() as PlayerDocument)));
}
