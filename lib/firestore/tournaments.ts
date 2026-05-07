import {
  addDoc,
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
} from "firebase/firestore";

import { db } from "@/lib/firebase";
import {
  type CreateTournamentInput,
  type TournamentDocument,
  type TournamentPrivateSettings,
} from "@/lib/firestore/types";

const tournamentsRef = collection(db, "tournaments");

export async function createTournament(
  input: CreateTournamentInput,
): Promise<string> {
  const newRef = doc(tournamentsRef);
  const now = serverTimestamp();
  const { venuePin, ...tournamentData } = input;

  await setDoc(newRef, {
    ...tournamentData,
    id: newRef.id,
    status: "draft",
    publicViewEnabled: input.publicViewEnabled ?? false,
    createdAt: now,
    updatedAt: now,
  });

  await setDoc(doc(db, "tournaments", newRef.id, "private", "settings"), {
    venuePin,
  });

  return newRef.id;
}

export async function getTournamentById(
  tournamentId: string,
): Promise<TournamentDocument | null> {
  const snapshot = await getDoc(doc(db, "tournaments", tournamentId));
  if (!snapshot.exists()) return null;
  return snapshot.data() as TournamentDocument;
}

export async function updateTournament(
  tournamentId: string,
  patch: Partial<Omit<TournamentDocument, "id" | "createdAt">>,
): Promise<void> {
  await updateDoc(doc(db, "tournaments", tournamentId), {
    ...patch,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteTournament(tournamentId: string): Promise<void> {
  await deleteDoc(doc(db, "tournaments", tournamentId));
}

export function subscribeToOrganizerTournaments(
  organizerId: string,
  onData: (docs: TournamentDocument[]) => void,
): Unsubscribe {
  const q = query(
    tournamentsRef,
    where("organizerId", "==", organizerId),
    orderBy("createdAt", "desc"),
  );
  return onSnapshot(
    q,
    (snapshot) =>
      onData(snapshot.docs.map((d) => d.data() as TournamentDocument)),
    (error) => {
      console.error("Error subscribing to organizer tournaments:", error);
      onData([]); // Fallback to unblock loading state
    },
  );
}

export function subscribeToPublicTournamentBySlug(
  slug: string,
  onData: (doc: TournamentDocument | null) => void,
): Unsubscribe {
  const q = query(
    tournamentsRef,
    where("slug", "==", slug),
    where("publicViewEnabled", "==", true),
  );
  return onSnapshot(q, (snapshot) => {
    if (snapshot.empty) {
      onData(null);
      return;
    }
    onData(snapshot.docs[0].data() as TournamentDocument);
  });
}

export function subscribeToPublicTournaments(
  onData: (docs: TournamentDocument[]) => void,
): Unsubscribe {
  const q = query(tournamentsRef, where("publicViewEnabled", "==", true));
  return onSnapshot(
    q,
    (snapshot) => {
      const docs = snapshot.docs.map((d) => d.data() as TournamentDocument);
      // Client-side sort to avoid Firestore composite index requirement
      docs.sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis());
      onData(docs);
    },
    (error) => {
      console.error("Error subscribing to public tournaments:", error);
      onData([]); // Fallback to unblock loading state
    },
  );
}

export function subscribeToTournamentById(
  tournamentId: string,
  onData: (doc: TournamentDocument | null) => void,
): Unsubscribe {
  const ref = doc(db, "tournaments", tournamentId);
  return onSnapshot(ref, (snapshot) =>
    onData(snapshot.exists() ? (snapshot.data() as TournamentDocument) : null),
  );
}

export async function getTournamentPrivateSettings(
  tournamentId: string,
): Promise<TournamentPrivateSettings | null> {
  const snapshot = await getDoc(
    doc(db, "tournaments", tournamentId, "private", "settings"),
  );
  if (!snapshot.exists()) return null;
  return snapshot.data() as TournamentPrivateSettings;
}

export async function validateScorekeeperAccess(
  tournamentId: string,
  userId: string,
): Promise<boolean> {
  const snapshot = await getDoc(
    doc(db, "tournaments", tournamentId, "scorekeeperAccess", userId),
  );
  if (!snapshot.exists()) return false;
  const data = snapshot.data();
  return data.validated === true;
}

export async function grantScorekeeperAccess(
  tournamentId: string,
  userId: string,
): Promise<void> {
  await setDoc(
    doc(db, "tournaments", tournamentId, "scorekeeperAccess", userId),
    {
      validated: true,
      tournamentId,
      validatedAt: serverTimestamp(),
    },
  );
}

export async function revokeScorekeeperAccess(
  tournamentId: string,
  userId: string,
): Promise<void> {
  await deleteDoc(
    doc(db, "tournaments", tournamentId, "scorekeeperAccess", userId),
  );
}
