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

    const accesses = await getDocs(collection(db, 'tournaments', tid, 'scorekeeperAccess'));
    if (!accesses.empty) {
      const batch = writeBatch(db);
      accesses.docs.forEach((d) => batch.delete(d.ref));
      await batch.commit();
      console.log(`  deleted ${accesses.size} scorekeeperAccess docs`);
    }

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
