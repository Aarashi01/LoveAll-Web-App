import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type Unsubscribe,
} from 'firebase/firestore';

import { db } from '@/lib/firebase';
import { type CreateTournamentInput, type TournamentDocument } from '@/lib/firestore/types';

const tournamentsRef = collection(db, 'tournaments');

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

export async function getTournamentById(tournamentId: string): Promise<TournamentDocument | null> {
  const snapshot = await getDoc(doc(db, 'tournaments', tournamentId));
  if (!snapshot.exists()) return null;
  return snapshot.data() as TournamentDocument;
}

export async function updateTournament(
  tournamentId: string,
  patch: Partial<Omit<TournamentDocument, 'id' | 'createdAt'>>,
): Promise<void> {
  await updateDoc(doc(db, 'tournaments', tournamentId), {
    ...patch,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteTournament(tournamentId: string): Promise<void> {
  await deleteDoc(doc(db, 'tournaments', tournamentId));
}

export function subscribeToOrganizerTournaments(
  organizerId: string,
  onData: (docs: TournamentDocument[]) => void,
): Unsubscribe {
  const q = query(tournamentsRef, where('organizerId', '==', organizerId), orderBy('createdAt', 'desc'));
  return onSnapshot(q, (snapshot) => onData(snapshot.docs.map((d) => d.data() as TournamentDocument)));
}

export function subscribeToPublicTournamentBySlug(
  slug: string,
  onData: (doc: TournamentDocument | null) => void,
): Unsubscribe {
  const q = query(tournamentsRef, where('slug', '==', slug), where('publicViewEnabled', '==', true));
  return onSnapshot(q, (snapshot) => {
    if (snapshot.empty) {
      onData(null);
      return;
    }
    onData(snapshot.docs[0].data() as TournamentDocument);
  });
}
