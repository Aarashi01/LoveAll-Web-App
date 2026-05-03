import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { PairingQR } from '@/components/scorekeeper/PairingQR';
import { auth } from '@/lib/firebase';
import { getTournamentById } from '@/lib/firestore/tournaments';
import {
  createPairingRequest,
  defaultDeviceLabel,
  deletePairingRequest,
  ensureAnonymousAuth,
  isAccessActive,
  subscribeToOwnAccess,
  type CreatePairingResult,
} from '@/lib/scorekeeper-pairing';
import { useAppStore } from '@/store/app.store';

type Phase =
  | 'loading-tournament'
  | 'tournament-not-found'
  | 'pick-device-label'
  | 'creating-pairing'
  | 'waiting-for-approval'
  | 'approved'
  | 'error';

export default function JoinScreen() {
  const { tournamentId } = useLocalSearchParams<{ tournamentId: string }>();
  const router = useRouter();
  const setScorekeeperTournament = useAppStore((s) => s.setScorekeeperTournament);

  const [phase, setPhase] = useState<Phase>('loading-tournament');
  const [tournamentName, setTournamentName] = useState('');
  const [label, setLabel] = useState(defaultDeviceLabel());
  const [pairing, setPairing] = useState<CreatePairingResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const accessUnsubRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!tournamentId) return;
    setScorekeeperTournament(tournamentId);

    (async () => {
      try {
        const t = await getTournamentById(tournamentId);
        if (!t) {
          setPhase('tournament-not-found');
          return;
        }
        setTournamentName(t.name);
        await ensureAnonymousAuth();
        setPhase('pick-device-label');
      } catch (e) {
        setErrorMsg(e instanceof Error ? e.message : 'Network error');
        setPhase('error');
      }
    })();
  }, [tournamentId, setScorekeeperTournament]);

  useEffect(() => {
    if (!tournamentId) return;
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    const unsub = subscribeToOwnAccess(tournamentId, uid, (access) => {
      if (isAccessActive(access)) {
        setPhase('approved');
        setTimeout(() => router.replace('/(scorekeeper)'), 1000);
      }
    });
    accessUnsubRef.current = unsub;
    return () => unsub();
  }, [tournamentId, router]);

  const startPairing = useCallback(async () => {
    if (!tournamentId) return;
    setPhase('creating-pairing');
    try {
      const result = await createPairingRequest(tournamentId, label.trim() || 'Device');
      setPairing(result);
      setPhase('waiting-for-approval');
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Could not create pairing request');
      setPhase('error');
    }
  }, [tournamentId, label]);

  const refreshQR = useCallback(async () => {
    if (pairing && tournamentId) {
      await deletePairingRequest(tournamentId, pairing.requestId).catch(() => undefined);
    }
    await startPairing();
  }, [pairing, tournamentId, startPairing]);

  if (phase === 'loading-tournament') {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#3B82F6" />
      </View>
    );
  }

  if (phase === 'tournament-not-found') {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>Tournament not found</Text>
        <Text style={styles.subtle}>Check the link or ask the organizer.</Text>
      </View>
    );
  }

  if (phase === 'error') {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>Something went wrong</Text>
        <Text style={styles.subtle}>{errorMsg}</Text>
        <Pressable style={styles.btn} onPress={startPairing}>
          <Text style={styles.btnText}>Try again</Text>
        </Pressable>
      </View>
    );
  }

  if (phase === 'pick-device-label') {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>Join {tournamentName}</Text>
        <Text style={styles.subtle}>What should we call this device?</Text>
        <TextInput
          value={label}
          onChangeText={setLabel}
          maxLength={40}
          style={styles.input}
          placeholder="Device label"
          placeholderTextColor="#475569"
        />
        <Pressable style={styles.btn} onPress={startPairing}>
          <Text style={styles.btnText}>Get pairing QR</Text>
        </Pressable>
      </View>
    );
  }

  if (phase === 'creating-pairing') {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#3B82F6" />
      </View>
    );
  }

  if (phase === 'approved') {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>Approved — opening scorekeeper…</Text>
      </View>
    );
  }

  return (
    <View style={styles.center}>
      <Text style={styles.title}>Show this to the organizer</Text>
      <Text style={styles.subtle}>{tournamentName} · {label}</Text>
      {pairing && (
        <PairingQR
          payload={pairing.payload}
          expiresAtMs={pairing.expiresAtMs}
          onRefresh={refreshQR}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    backgroundColor: '#0B1120',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 16,
  },
  title: { color: '#F8FAFC', fontSize: 22, fontWeight: '700', textAlign: 'center' },
  subtle: { color: '#94A3B8', fontSize: 14, textAlign: 'center' },
  input: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#1E293B',
    color: '#F8FAFC',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    fontSize: 16,
  },
  btn: {
    backgroundColor: '#3B82F6',
    paddingVertical: 12,
    paddingHorizontal: 28,
    borderRadius: 8,
  },
  btnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
});
