import { useEffect, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { QRScannerModal } from '@/components/organizer/QRScannerModal';
import {
  approveScorekeeper,
  subscribeToPendingRequests,
} from '@/lib/firestore/scorekeeper-access';
import type { PairingRequest, PairingQRPayload } from '@/lib/scorekeeper-pairing';

interface Props {
  tournamentId: string;
}

function ageMins(req: PairingRequest): number {
  return Math.max(0, Math.floor((Date.now() - req.createdAt.toMillis()) / 60_000));
}

export function PendingScorekeepersCard({ tournamentId }: Props) {
  const [pending, setPending] = useState<PairingRequest[]>([]);
  const [scannerOpen, setScannerOpen] = useState(false);

  useEffect(
    () => subscribeToPendingRequests(tournamentId, setPending),
    [tournamentId],
  );

  const handleScanned = async (payload: PairingQRPayload) => {
    const result = await approveScorekeeper(payload, pending);
    setScannerOpen(false);
    if (!result.ok) {
      Alert.alert('Could not approve', result.reason);
    }
  };

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Pending scorekeepers</Text>
        <Pressable
          style={[styles.scanBtn, pending.length === 0 && styles.scanBtnDim]}
          onPress={() => setScannerOpen(true)}
        >
          <Text style={styles.scanBtnText}>Scan QR</Text>
        </Pressable>
      </View>
      {pending.length === 0 ? (
        <Text style={styles.empty}>No volunteers waiting for approval.</Text>
      ) : (
        <FlatList
          data={pending}
          keyExtractor={(r) => r.id}
          renderItem={({ item }) => (
            <View style={styles.row}>
              <Text style={styles.label}>{item.deviceLabel}</Text>
              <Text style={styles.meta}>{ageMins(item)} min ago</Text>
            </View>
          )}
          scrollEnabled={false}
        />
      )}
      <QRScannerModal
        visible={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScanned={handleScanned}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#0F172A', borderRadius: 12, padding: 16, gap: 12 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { color: '#F8FAFC', fontSize: 16, fontWeight: '700' },
  scanBtn: { backgroundColor: '#3B82F6', paddingVertical: 8, paddingHorizontal: 16, borderRadius: 8 },
  scanBtnDim: { opacity: 0.6 },
  scanBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
  empty: { color: '#64748B', fontSize: 13, fontStyle: 'italic' },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 },
  label: { color: '#F8FAFC', fontSize: 14 },
  meta: { color: '#94A3B8', fontSize: 12 },
});
