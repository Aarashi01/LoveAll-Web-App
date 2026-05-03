import { CameraView, useCameraPermissions } from 'expo-camera';
import { useCallback, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { decodeQRPayload, type PairingQRPayload } from '@/lib/scorekeeper-pairing';

interface Props {
  visible: boolean;
  onClose: () => void;
  onScanned: (payload: PairingQRPayload) => void;
}

export function QRScannerModal({ visible, onClose, onScanned }: Props) {
  const [permission, requestPermission] = useCameraPermissions();
  const [error, setError] = useState<string | null>(null);
  const [handled, setHandled] = useState(false);

  const handleBarcode = useCallback(
    ({ data }: { data: string }) => {
      if (handled) return;
      const payload = decodeQRPayload(data);
      if (!payload) {
        setError('That QR is not a scorekeeper pairing code.');
        return;
      }
      setHandled(true);
      onScanned(payload);
    },
    [handled, onScanned],
  );

  if (!visible && handled) setHandled(false);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Scan scorekeeper QR</Text>
          <Pressable onPress={onClose}>
            <Text style={styles.close}>Close</Text>
          </Pressable>
        </View>

        {!permission ? (
          <View style={styles.center}><Text style={styles.body}>Loading…</Text></View>
        ) : !permission.granted ? (
          <View style={styles.center}>
            <Text style={styles.body}>Camera access is needed to scan the QR.</Text>
            <Pressable style={styles.btn} onPress={requestPermission}>
              <Text style={styles.btnText}>Grant camera access</Text>
            </Pressable>
          </View>
        ) : (
          <CameraView
            style={styles.camera}
            onBarcodeScanned={handleBarcode}
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          />
        )}

        {error && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{error}</Text>
            <Pressable onPress={() => setError(null)}>
              <Text style={styles.close}>Dismiss</Text>
            </Pressable>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B1120' },
  header: {
    paddingTop: 56,
    paddingHorizontal: 16,
    paddingBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: { color: '#F8FAFC', fontSize: 18, fontWeight: '700' },
  close: { color: '#3B82F6', fontSize: 15, fontWeight: '600' },
  camera: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 16 },
  body: { color: '#94A3B8', fontSize: 14, textAlign: 'center' },
  btn: { backgroundColor: '#3B82F6', paddingVertical: 12, paddingHorizontal: 28, borderRadius: 8 },
  btnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
  errorBanner: {
    backgroundColor: '#7F1D1D',
    paddingVertical: 10,
    paddingHorizontal: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  errorText: { color: '#FECACA', fontSize: 13, flex: 1 },
});
