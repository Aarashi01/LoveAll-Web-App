import { signInAnonymously } from "firebase/auth";

import { auth } from "@/lib/firebase";
import {
  getTournamentPrivateSettings,
  grantScorekeeperAccess,
} from "@/lib/firestore/tournaments";
import { useAppStore } from "@/store/app.store";

export async function activateScorekeeperSession(
  pin: string,
  tournamentId: string,
): Promise<void> {
  const privateSettings = await getTournamentPrivateSettings(tournamentId);

  if (!privateSettings || pin !== privateSettings.venuePin) {
    throw new Error("Invalid PIN");
  }

  await signInAnonymously(auth);

  const userId = auth.currentUser?.uid;
  if (!userId) {
    throw new Error("Failed to get user ID");
  }

  await grantScorekeeperAccess(tournamentId, userId);

  useAppStore.getState().setScorekeeperSession(pin, tournamentId);
}
