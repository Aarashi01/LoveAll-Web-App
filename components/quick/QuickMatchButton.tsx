import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

interface Props {
  style?: object;
}

export function QuickMatchButton({ style }: Props) {
  return (
    <Pressable
      onPress={() => router.push('/quick')}
      style={({ pressed }) => [styles.button, pressed && styles.pressed, style]}
      accessibilityRole="button"
      accessibilityLabel="Start a Quick Match — no login required"
    >
      <View style={styles.iconWrap}>
        <Text style={styles.icon}>⚡</Text>
      </View>
      <View style={styles.textWrap}>
        <Text style={styles.label}>Quick Match</Text>
        <Text style={styles.sublabel}>No login required</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F172A',
    borderColor: '#3B82F6',
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 18,
    gap: 14,
  },
  pressed: { opacity: 0.85 },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: { fontSize: 18 },
  textWrap: { flex: 1 },
  label: { color: '#F8FAFC', fontSize: 15, fontWeight: '700' },
  sublabel: { color: '#94A3B8', fontSize: 12, marginTop: 2 },
});
