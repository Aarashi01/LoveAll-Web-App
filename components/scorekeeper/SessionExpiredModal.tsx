import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

interface Props {
  visible: boolean;
  reason: 'expired' | 'revoked';
  onGetNewQR: () => void;
}

export function SessionExpiredModal({ visible, reason, onGetNewQR }: Props) {
  const title =
    reason === 'expired'
      ? 'Your scoring session has ended.'
      : 'The organizer ended your session.';

  return (
    <Modal transparent visible={visible} animationType="fade">
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>{title}</Text>
          <Pressable style={styles.btn} onPress={onGetNewQR}>
            <Text style={styles.btnText}>Get new QR</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(2, 6, 23, 0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: '#0F172A',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    gap: 20,
    maxWidth: 380,
    width: '100%',
  },
  title: { color: '#F8FAFC', fontSize: 18, textAlign: 'center', fontWeight: '600' },
  btn: {
    backgroundColor: '#3B82F6',
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 10,
  },
  btnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
});
