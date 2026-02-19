import { Pressable, StyleSheet, Text, View } from 'react-native';

type ScoreInputProps = {
  label: string;
  score: number;
  onTapCard: () => void;
  onIncrease: () => void;
  onDecrease: () => void;
};

export function ScoreInput({ label, score, onTapCard, onIncrease, onDecrease }: ScoreInputProps) {
  return (
    <View style={styles.container}>
      <Pressable style={styles.card} onPress={onTapCard}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.score}>{score}</Text>
      </Pressable>

      <View style={styles.controlsRow}>
        <Pressable style={[styles.controlButton, styles.decreaseButton]} onPress={onDecrease}>
          <Text style={styles.controlLabel}>-1</Text>
        </Pressable>
        <Pressable style={[styles.controlButton, styles.increaseButton]} onPress={onIncrease}>
          <Text style={styles.controlLabel}>+1</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    gap: 10,
  },
  card: {
    flex: 1,
    minHeight: 220,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#CBD5E1',
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 20,
    gap: 8,
  },
  label: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
  },
  score: {
    fontSize: 84,
    lineHeight: 90,
    fontWeight: '900',
    color: '#0F172A',
  },
  controlsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  controlButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    minHeight: 56,
  },
  decreaseButton: {
    backgroundColor: '#B91C1C',
  },
  increaseButton: {
    backgroundColor: '#166534',
  },
  controlLabel: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 20,
    lineHeight: 24,
  },
});
