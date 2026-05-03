import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import { encodeQRPayload, type PairingQRPayload } from '@/lib/scorekeeper-pairing';

interface Props {
  payload: PairingQRPayload;
  expiresAtMs: number;
  onRefresh: () => void;
}

function formatRemaining(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function PairingQR({ payload, expiresAtMs, onRefresh }: Props) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const remaining = expiresAtMs - now;
  const expired = remaining <= 0;

  return (
    <View style={styles.container}>
      <View style={styles.qrFrame}>
        <QRCode value={encodeQRPayload(payload)} size={240} />
      </View>
      {expired ? (
        <>
          <Text style={styles.expiredText}>QR expired</Text>
          <Pressable style={styles.refreshBtn} onPress={onRefresh}>
            <Text style={styles.refreshBtnText}>Get a new QR</Text>
          </Pressable>
        </>
      ) : (
        <Text style={styles.countdown}>
          Show this to the organizer · expires in {formatRemaining(remaining)}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', gap: 16 },
  qrFrame: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
  },
  countdown: { color: '#94A3B8', fontSize: 14, textAlign: 'center' },
  expiredText: { color: '#F87171', fontSize: 16, fontWeight: '600' },
  refreshBtn: {
    backgroundColor: '#3B82F6',
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  refreshBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
});
