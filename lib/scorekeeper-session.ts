import { signInAnonymously } from 'firebase/auth';

import { auth } from '@/lib/firebase';
import { type TournamentDocument } from '@/lib/firestore/types';
import { useAppStore } from '@/store/app.store';

export async function activateScorekeeperSession(
  pin: string,
  tournament: TournamentDocument,
): Promise<void> {
  if (pin !== tournament.venuePin) {
    throw new Error('Invalid PIN');
  }

  await signInAnonymously(auth);
  useAppStore.getState().setScorekeeperSession(pin, tournament.id);
}

