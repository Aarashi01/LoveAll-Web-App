import { useEffect, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import {
  cleanupExpiredAccess,
  revokeScorekeeper,
  subscribeToActiveScorekeepers,
} from '@/lib/firestore/scorekeeper-access';
import type { ScorekeeperAccess } from '@/lib/scorekeeper-pairing';

interface Props {
  tournamentId: string;
}

function timeRemaining(expiresAtMs: number): string {
  const ms = Math.max(0, expiresAtMs - Date.now());
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export function ActiveScorekeepersList({ tournamentId }: Props) {
  const [rows, setRows] = useState<Array<ScorekeeperAccess & { uid: string }>>([]);

  useEffect(() => {
    cleanupExpiredAccess(tournamentId);
    return subscribeToActiveScorekeepers(tournamentId, setRows);
  }, [tournamentId]);

  const confirmRevoke = (uid: string, label: string) => {
    Alert.alert('Revoke access?', `End the scoring session for ${label}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Revoke',
        style: 'destructive',
        onPress: () => revokeScorekeeper(tournamentId, uid),
      },
    ]);
  };

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Active scorekeepers</Text>
      {rows.length === 0 ? (
        <Text style={styles.empty}>No one is currently scoring.</Text>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(r) => r.uid}
          scrollEnabled={false}
          renderItem={({ item }) => (
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>{item.deviceLabel}</Text>
                <Text style={styles.meta}>{timeRemaining(item.expiresAt.toMillis())} left</Text>
              </View>
              <Pressable
                style={styles.revokeBtn}
                onPress={() => confirmRevoke(item.uid, item.deviceLabel)}
              >
                <Text style={styles.revokeBtnText}>Revoke</Text>
              </Pressable>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#0F172A', borderRadius: 12, padding: 16, gap: 12 },
  title: { color: '#F8FAFC', fontSize: 16, fontWeight: '700' },
  empty: { color: '#64748B', fontSize: 13, fontStyle: 'italic' },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  label: { color: '#F8FAFC', fontSize: 14 },
  meta: { color: '#94A3B8', fontSize: 12, marginTop: 2 },
  revokeBtn: { backgroundColor: '#7F1D1D', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 6 },
  revokeBtnText: { color: '#FECACA', fontSize: 13, fontWeight: '600' },
});
