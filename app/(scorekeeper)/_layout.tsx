import { Slot, useRouter, useSegments } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { auth } from '@/lib/firebase';
import {
  isAccessActive,
  subscribeToOwnAccess,
  type ScorekeeperAccess,
} from '@/lib/scorekeeper-pairing';
import { SessionBanner } from '@/components/scorekeeper/SessionBanner';
import { SessionExpiredModal } from '@/components/scorekeeper/SessionExpiredModal';
import { useAppStore } from '@/store/app.store';

/**
 * Wraps every screen under app/(scorekeeper)/. Subscribes to the access
 * doc for the current anonymous user and:
 *  - lets `/join/[tournamentId]` render unconditionally (it's the entry point)
 *  - redirects to `/join/[tournamentId]` if no active access on other screens
 *  - shows the SessionBanner on score-entry screens
 *  - shows SessionExpiredModal on revoke
 *
 * NOTE: This task lands the shell. The actual `tournamentId` source — a
 * Zustand slot set by the join + score-entry screens — is wired in Task 14.
 * Until then, `tournamentId` stays null and the subscription effect short-
 * circuits, so the screens render without route-guarding. Task 14 completes
 * the loop.
 */
export default function ScorekeeperLayout() {
  const router = useRouter();
  const segments = useSegments();
  const tournamentId = useAppStore((s) => s.scorekeeperCtx.tournamentId);
  const [access, setAccess] = useState<ScorekeeperAccess | null>(null);
  const [revoked, setRevoked] = useState(false);

  const onJoinScreen = segments.some((s) => s === 'join');

  useEffect(() => {
    if (!tournamentId) return;
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    let prevHadAccess = false;
    const unsub = subscribeToOwnAccess(tournamentId, uid, (next) => {
      if (prevHadAccess && !next) setRevoked(true);
      prevHadAccess = !!next;
      setAccess(next);
      if (!onJoinScreen && !isAccessActive(next)) {
        router.replace(`/(scorekeeper)/join/${tournamentId}`);
      }
    });
    return unsub;
  }, [tournamentId, onJoinScreen, router]);

  return (
    <View style={{ flex: 1, backgroundColor: '#0B1120' }}>
      {access && !onJoinScreen && (
        <SessionBanner expiresAtMs={access.expiresAt.toMillis()} />
      )}
      <Slot />
      <SessionExpiredModal
        visible={revoked}
        reason="revoked"
        onGetNewQR={() => {
          setRevoked(false);
          if (tournamentId) router.replace(`/(scorekeeper)/join/${tournamentId}`);
        }}
      />
    </View>
  );
}
