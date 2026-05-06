import { router } from 'expo-router';
import { useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useQuickMatchStore } from '@/store/quick-match.store';
import type { QuickFormat } from '@/lib/quick-match-engine';

export default function QuickMatchSetup() {
  const startMatch = useQuickMatchStore((s) => s.startMatch);

  const [format, setFormat] = useState<QuickFormat>('singles');
  const [sideAName, setSideAName] = useState('');
  const [sideBName, setSideBName] = useState('');
  const [pointsToWin, setPointsToWin] = useState(21);
  const [bestOf, setBestOf] = useState<1 | 3>(1);
  const [deuceEnabled, setDeuceEnabled] = useState(true);
  const [pointsError, setPointsError] = useState<string | null>(null);

  const validate = (): boolean => {
    if (!Number.isInteger(pointsToWin) || pointsToWin < 1 || pointsToWin > 99) {
      setPointsError('Points must be a whole number between 1 and 99.');
      return false;
    }
    setPointsError(null);
    return true;
  };

  const handleStart = () => {
    if (!validate()) return;
    startMatch({
      format,
      sideAName: sideAName.trim() || 'Side A',
      sideBName: sideBName.trim() || 'Side B',
      rules: { pointsToWin, bestOf, deuceEnabled },
    });
    router.push('/quick/play');
  };

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
      <Text style={styles.title}>Quick Match</Text>
      <Text style={styles.subtitle}>No login. No tournament. Just score a game.</Text>

      <View style={styles.card}>
        <Text style={styles.section}>Format</Text>
        <View style={styles.row}>
          <Pressable
            onPress={() => setFormat('singles')}
            style={[styles.chip, format === 'singles' && styles.chipActive]}
          >
            <Text style={[styles.chipText, format === 'singles' && styles.chipTextActive]}>Singles</Text>
          </Pressable>
          <Pressable
            onPress={() => setFormat('doubles')}
            style={[styles.chip, format === 'doubles' && styles.chipActive]}
          >
            <Text style={[styles.chipText, format === 'doubles' && styles.chipTextActive]}>Doubles</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.section}>Sides</Text>
        <Text style={styles.label}>Side A</Text>
        <TextInput
          value={sideAName}
          onChangeText={setSideAName}
          placeholder="Side A"
          placeholderTextColor="#475569"
          maxLength={40}
          style={styles.input}
        />
        <Text style={[styles.label, { marginTop: 12 }]}>Side B</Text>
        <TextInput
          value={sideBName}
          onChangeText={setSideBName}
          placeholder="Side B"
          placeholderTextColor="#475569"
          maxLength={40}
          style={styles.input}
        />
      </View>

      <View style={styles.card}>
        <Text style={styles.section}>Scoring</Text>
        <Text style={styles.label}>Points to win</Text>
        <View style={styles.stepperRow}>
          <Pressable
            onPress={() => setPointsToWin((p) => Math.max(1, p - 1))}
            style={styles.stepperBtn}
          >
            <Text style={styles.stepperLabel}>−</Text>
          </Pressable>
          <TextInput
            value={String(pointsToWin)}
            onChangeText={(v) => {
              const n = parseInt(v, 10);
              setPointsToWin(Number.isNaN(n) ? 0 : n);
              setPointsError(null);
            }}
            keyboardType="numeric"
            style={styles.stepperInput}
          />
          <Pressable
            onPress={() => setPointsToWin((p) => Math.min(99, p + 1))}
            style={styles.stepperBtn}
          >
            <Text style={styles.stepperLabel}>+</Text>
          </Pressable>
        </View>
        {pointsError && <Text style={styles.error}>{pointsError}</Text>}

        <Text style={[styles.label, { marginTop: 16 }]}>Best of</Text>
        <View style={styles.row}>
          <Pressable
            onPress={() => setBestOf(1)}
            style={[styles.chip, bestOf === 1 && styles.chipActive]}
          >
            <Text style={[styles.chipText, bestOf === 1 && styles.chipTextActive]}>1</Text>
          </Pressable>
          <Pressable
            onPress={() => setBestOf(3)}
            style={[styles.chip, bestOf === 3 && styles.chipActive]}
          >
            <Text style={[styles.chipText, bestOf === 3 && styles.chipTextActive]}>3</Text>
          </Pressable>
        </View>

        <View style={styles.deuceRow}>
          <Text style={styles.label}>Deuce (win by 2, capped at +9)</Text>
          <Switch value={deuceEnabled} onValueChange={setDeuceEnabled} />
        </View>
      </View>

      <Pressable onPress={handleStart} style={styles.startBtn}>
        <Text style={styles.startBtnText}>Start match →</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: '#0B1120' },
  container: { padding: 24, gap: 16, maxWidth: 560, width: '100%', alignSelf: 'center' },
  title: { color: '#F8FAFC', fontSize: 32, fontWeight: '700' },
  subtitle: { color: '#94A3B8', fontSize: 14, marginBottom: 8 },
  card: { backgroundColor: '#0F172A', padding: 16, borderRadius: 12, gap: 8 },
  section: { color: '#F8FAFC', fontSize: 16, fontWeight: '700', marginBottom: 4 },
  label: { color: '#CBD5E1', fontSize: 13, fontWeight: '600' },
  row: { flexDirection: 'row', gap: 8 },
  chip: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  chipActive: { borderColor: '#3B82F6', backgroundColor: '#1E3A8A' },
  chipText: { color: '#94A3B8', fontSize: 14, fontWeight: '600' },
  chipTextActive: { color: '#FFFFFF' },
  input: {
    backgroundColor: '#1E293B',
    color: '#F8FAFC',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    fontSize: 15,
  },
  stepperRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  stepperBtn: {
    width: 44,
    height: 44,
    backgroundColor: '#1E293B',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperLabel: { color: '#F8FAFC', fontSize: 22, fontWeight: '700' },
  stepperInput: {
    flex: 1,
    backgroundColor: '#1E293B',
    color: '#F8FAFC',
    height: 44,
    borderRadius: 8,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '700',
  },
  deuceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  error: { color: '#F87171', fontSize: 12, marginTop: 4 },
  startBtn: {
    backgroundColor: '#3B82F6',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  startBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
});
