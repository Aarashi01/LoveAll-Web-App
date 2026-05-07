import { router } from 'expo-router';
import { useState } from 'react';
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';

import { AppButton } from '@/components/ui/AppButton';
import { AppInput } from '@/components/ui/AppInput';
import { theme } from '@/constants/theme';
import type { QuickFormat } from '@/lib/quick-match-engine';
import { useQuickMatchStore } from '@/store/quick-match.store';

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
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Hero band */}
        <View style={styles.hero}>
          <Pressable onPress={() => router.back()} hitSlop={8} style={styles.backArrow}>
            <Text style={styles.backArrowText}>←</Text>
          </Pressable>
          <Text style={styles.heroEyebrow}>Quick Match · Off the cuff</Text>
          <Text style={styles.heroTitle}>JUST{'\n'}SCORE.</Text>
          <Text style={styles.heroLead}>
            No login. No tournament. Score a single match in two taps.
          </Text>
        </View>

        <View style={styles.content}>
          {/* Format */}
          <Section title="Format">
            <View style={styles.segmented}>
              {(['singles', 'doubles'] as QuickFormat[]).map((opt) => {
                const active = format === opt;
                return (
                  <Pressable
                    key={opt}
                    style={[styles.segment, active && styles.segmentActive]}
                    onPress={() => setFormat(opt)}
                  >
                    <Text style={[styles.segmentText, active && styles.segmentTextActive]}>
                      {opt === 'singles' ? 'Singles' : 'Doubles'}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </Section>

          {/* Sides */}
          <Section title="Sides">
            <AppInput
              label="Side A"
              value={sideAName}
              onChangeText={setSideAName}
              placeholder="Side A"
              maxLength={40}
            />
            <AppInput
              label="Side B"
              value={sideBName}
              onChangeText={setSideBName}
              placeholder="Side B"
              maxLength={40}
            />
          </Section>

          {/* Scoring */}
          <Section title="Scoring">
            <View style={{ gap: 8 }}>
              <Text style={styles.fieldLabel}>Points to win</Text>
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
              {pointsError ? <Text style={styles.error}>{pointsError}</Text> : null}
            </View>

            <View style={{ gap: 8 }}>
              <Text style={styles.fieldLabel}>Best of</Text>
              <View style={styles.segmented}>
                {[1, 3].map((value) => {
                  const active = bestOf === value;
                  return (
                    <Pressable
                      key={value}
                      style={[styles.segment, active && styles.segmentActive]}
                      onPress={() => setBestOf(value as 1 | 3)}
                    >
                      <Text style={[styles.segmentText, active && styles.segmentTextActive]}>
                        {value === 1 ? '1 game' : 'Best of 3'}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View style={styles.deuceRow}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={styles.fieldLabel}>Deuce</Text>
                <Text style={styles.helperText}>Win by 2, capped at +9.</Text>
              </View>
              <Switch
                value={deuceEnabled}
                onValueChange={setDeuceEnabled}
                trackColor={{ false: '#D4D4D4', true: theme.colors.text }}
                thumbColor="#FFFFFF"
                ios_backgroundColor="#D4D4D4"
              />
            </View>
          </Section>

          <AppButton label="Start match →" onPress={handleStart} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>{title}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scroll: {
    paddingBottom: 48,
  },
  hero: {
    backgroundColor: theme.colors.surfaceInverse,
    paddingHorizontal: theme.spacing.xl,
    paddingTop: theme.spacing.lg,
    paddingBottom: theme.spacing.xxl,
    gap: 8,
  },
  backArrow: {
    width: 36,
    height: 36,
    borderRadius: theme.radius.full,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
    ...(typeof window !== 'undefined' && ({ cursor: 'pointer' } as any)),
  },
  backArrowText: {
    color: theme.colors.textInverse,
    fontSize: 16,
    fontWeight: '800',
  },
  heroEyebrow: {
    color: theme.colors.live,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.8,
    textTransform: 'uppercase',
  },
  heroTitle: {
    color: theme.colors.textInverse,
    fontSize: 56,
    fontWeight: '900',
    letterSpacing: -2,
    lineHeight: 56,
  },
  heroLead: {
    color: theme.colors.textInverse,
    opacity: 0.7,
    fontSize: 14,
    fontWeight: '500',
  },
  content: {
    paddingHorizontal: theme.spacing.xl,
    paddingTop: theme.spacing.xl,
    gap: theme.spacing.lg,
    width: '100%',
    maxWidth: 600,
    alignSelf: 'center',
  },
  section: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.xl,
    gap: theme.spacing.md,
  },
  sectionLabel: {
    color: theme.colors.text,
    fontWeight: '900',
    fontSize: 12,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  fieldLabel: {
    color: theme.colors.text,
    fontWeight: '800',
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  helperText: {
    color: theme.colors.textMuted,
    fontWeight: '500',
    fontSize: 12,
    lineHeight: 16,
  },
  segmented: {
    flexDirection: 'row',
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  segment: {
    flex: 1,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    borderRightWidth: 1,
    borderRightColor: theme.colors.border,
  },
  segmentActive: {
    backgroundColor: theme.colors.text,
  },
  segmentText: {
    color: theme.colors.text,
    fontWeight: '700',
    fontSize: 13,
    letterSpacing: 0.4,
  },
  segmentTextActive: {
    color: theme.colors.textInverse,
    fontWeight: '900',
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  stepperBtn: {
    width: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRightWidth: 1,
    borderRightColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  stepperLabel: {
    color: theme.colors.text,
    fontSize: 22,
    fontWeight: '900',
  },
  stepperInput: {
    flex: 1,
    color: theme.colors.text,
    fontSize: 22,
    fontWeight: '900',
    textAlign: 'center',
    paddingVertical: 12,
    fontVariant: ['tabular-nums'],
    ...(typeof window !== 'undefined' && ({ outlineStyle: 'none' } as any)),
  },
  deuceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    paddingTop: theme.spacing.md,
    marginTop: 4,
  },
  error: {
    color: theme.colors.danger,
    fontSize: 12,
    fontWeight: '700',
  },
});
