import { Link, router } from 'expo-router';
import { type FirebaseError } from 'firebase/app';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';

import { AppButton } from '@/components/ui/AppButton';
import { AppInput } from '@/components/ui/AppInput';
import { theme, toCategoryLabel } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { createTournament } from '@/lib/firestore/tournaments';
import { type MatchCategory } from '@/lib/firestore/types';

const CATEGORY_OPTIONS: MatchCategory[] = ['MS', 'WS', 'MD', 'WD', 'XD'];

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

function randomPin(): string {
  return String(Math.floor(1000 + Math.random() * 9000));
}

export default function NewTournamentScreen() {
  const { user, loading } = useAuth();
  const organizerUser = user && !user.isAnonymous ? user : null;
  const [name, setName] = useState('');
  const [categories, setCategories] = useState<MatchCategory[]>(['MS']);
  const [bestOf, setBestOf] = useState<1 | 3>(3);
  const [pointsPerGame, setPointsPerGame] = useState<11 | 15 | 21>(21);
  const [groupCount, setGroupCount] = useState('4');
  const [knockoutSize, setKnockoutSize] = useState<16 | 8 | 4>(8);
  const [publicViewEnabled, setPublicViewEnabled] = useState(true);
  const [venuePin, setVenuePin] = useState(randomPin());
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ name?: string; categories?: string; groupCount?: string; venuePin?: string }>({});
  const [createdTournamentId, setCreatedTournamentId] = useState<string | null>(null);

  const deuceAt = useMemo(() => pointsPerGame - 1, [pointsPerGame]);

  const toggleCategory = (category: MatchCategory) => {
    setCategories((prev) =>
      prev.includes(category) ? prev.filter((item) => item !== category) : [...prev, category],
    );
  };

  const handleCreate = async () => {
    setFormError(null);
    setCreatedTournamentId(null);

    if (!organizerUser) {
      setFormError('Login required. Please sign in as an organizer first.');
      return;
    }

    const nextFieldErrors: { name?: string; categories?: string; groupCount?: string; venuePin?: string } = {};
    if (!name.trim()) nextFieldErrors.name = 'Please enter a tournament name.';
    if (categories.length === 0) nextFieldErrors.categories = 'Select at least one category.';
    const parsedGroupCount = Number(groupCount);
    if (!Number.isFinite(parsedGroupCount) || parsedGroupCount <= 0) {
      nextFieldErrors.groupCount = 'Group count must be a positive number.';
    }
    if (!/^\d{4}$/.test(venuePin)) nextFieldErrors.venuePin = 'Venue PIN must be 4 digits.';

    if (Object.keys(nextFieldErrors).length > 0) {
      setFieldErrors(nextFieldErrors);
      return;
    }
    setFieldErrors({});

    try {
      setSubmitting(true);
      const tournamentId = await createTournament({
        name: name.trim(),
        slug: slugify(name),
        organizerId: organizerUser.uid,
        categories,
        scoringRules: {
          bestOf,
          pointsPerGame,
          deuceEnabled: true,
          deuceAt,
          clearBy: 2,
          maxPoints: pointsPerGame === 21 ? 30 : pointsPerGame + 9,
        },
        groupCount: parsedGroupCount,
        knockoutSize,
        publicViewEnabled,
        venuePin,
      });

      setCreatedTournamentId(tournamentId);
      router.replace({ pathname: '/(organizer)/[id]/manage', params: { id: tournamentId } });
    } catch (error) {
      const firebaseError = error as FirebaseError;
      const message =
        firebaseError?.code && firebaseError?.message
          ? `${firebaseError.code}: ${firebaseError.message}`
          : error instanceof Error
            ? error.message
            : 'Failed to create tournament';
      setFormError(message);
    } finally {
      setSubmitting(false);
    }
  };

  const { width } = useWindowDimensions();
  const isWide = width >= 980;

  if (loading) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator size="large" color={theme.colors.text} />
      </SafeAreaView>
    );
  }

  if (!organizerUser) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.authBlocked}>
          <Text style={styles.eyebrow}>Sign in required</Text>
          <Text style={styles.title}>Create tournament.</Text>
          <Text style={styles.authBlockedText}>
            You must be signed in as an organizer to create a tournament.
          </Text>
          <AppButton label="Go to sign in" onPress={() => router.push('/(auth)/login')} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Hero */}
        <View style={styles.hero}>
          <Pressable onPress={() => router.back()} hitSlop={8} style={styles.backArrow}>
            <Text style={styles.backArrowText}>←</Text>
          </Pressable>
          <Text style={styles.heroEyebrow}>New tournament</Text>
          <Text style={styles.heroTitle}>SET IT UP.</Text>
          <Text style={styles.heroLead}>Configure format and structure before creating.</Text>
        </View>

        <View style={styles.content}>
          {formError ? <Text style={styles.errorText}>{formError}</Text> : null}
          {createdTournamentId ? (
            <View style={styles.successBox}>
              <Text style={styles.successTitle}>Tournament created.</Text>
              <Text style={styles.successMeta}>ID · {createdTournamentId}</Text>
              <Link
                href={{ pathname: '/(organizer)/[id]/manage', params: { id: createdTournamentId } }}
                style={styles.successLink}
              >
                Go to manage →
              </Link>
            </View>
          ) : null}

          <View style={isWide && styles.splitLayout}>
            <View style={[styles.column, isWide && styles.columnFlex]}>
              <Section title="Tournament details">
                <AppInput
                  label="Tournament name"
                  value={name}
                  onChangeText={(text) => {
                    setName(text);
                    if (fieldErrors.name) setFieldErrors((prev) => ({ ...prev, name: undefined }));
                  }}
                  placeholder="Enter tournament name"
                  errorText={fieldErrors.name}
                />

                <View style={styles.switchRow}>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={styles.fieldLabel}>Public spectator view</Text>
                    <Text style={styles.helperText}>
                      Anyone with the link can watch live scores.
                    </Text>
                  </View>
                  <Switch
                    value={publicViewEnabled}
                    onValueChange={setPublicViewEnabled}
                    trackColor={{ false: '#D4D4D4', true: theme.colors.text }}
                    thumbColor="#FFFFFF"
                    ios_backgroundColor="#D4D4D4"
                  />
                </View>
              </Section>

              <Section
                title="Match categories"
                subtitle="Select all event types available in this tournament."
              >
                <View style={[styles.optionGrid, fieldErrors.categories ? styles.optionGridError : undefined]}>
                  {CATEGORY_OPTIONS.map((category) => {
                    const selected = categories.includes(category);
                    return (
                      <Pressable
                        key={category}
                        style={[styles.optionChip, selected && styles.optionChipSelected]}
                        onPress={() => {
                          toggleCategory(category);
                          if (fieldErrors.categories) setFieldErrors((prev) => ({ ...prev, categories: undefined }));
                        }}
                      >
                        <Text style={[styles.optionChipText, selected && styles.optionChipTextSelected]}>
                          {toCategoryLabel(category)}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
                {fieldErrors.categories ? <Text style={styles.fieldErrorText}>{fieldErrors.categories}</Text> : null}
              </Section>
            </View>

            <View style={[styles.column, isWide && styles.columnFlex]}>
              <Section title="Scoring format">
                <SegmentRow
                  label="Match length"
                  value={bestOf}
                  options={[
                    { v: 1, label: 'Single set' },
                    { v: 3, label: 'Best of 3' },
                  ]}
                  onChange={(v) => setBestOf(v as 1 | 3)}
                />
                <SegmentRow
                  label="Points to win"
                  value={pointsPerGame}
                  options={[
                    { v: 11, label: '11' },
                    { v: 15, label: '15' },
                    { v: 21, label: '21' },
                  ]}
                  onChange={(v) => setPointsPerGame(v as 11 | 15 | 21)}
                />
              </Section>

              <Section title="Draw structure">
                <AppInput
                  label="Number of groups"
                  value={groupCount}
                  onChangeText={(text) => {
                    setGroupCount(text);
                    if (fieldErrors.groupCount) setFieldErrors((prev) => ({ ...prev, groupCount: undefined }));
                  }}
                  keyboardType="number-pad"
                  errorText={fieldErrors.groupCount}
                />
                <SegmentRow
                  label="Knockout bracket"
                  value={knockoutSize}
                  options={[
                    { v: 4, label: '4 players' },
                    { v: 8, label: '8 players' },
                    { v: 16, label: '16 players' },
                  ]}
                  onChange={(v) => setKnockoutSize(v as 16 | 8 | 4)}
                />
                <View style={styles.pinRow}>
                  <View style={{ flex: 1 }}>
                    <AppInput
                      label="Venue PIN (4 digits)"
                      value={venuePin}
                      onChangeText={(text) => {
                        setVenuePin(text);
                        if (fieldErrors.venuePin) setFieldErrors((prev) => ({ ...prev, venuePin: undefined }));
                      }}
                      maxLength={4}
                      keyboardType="number-pad"
                      errorText={fieldErrors.venuePin}
                    />
                  </View>
                  <AppButton variant="secondary" label="Regenerate" onPress={() => setVenuePin(randomPin())} />
                </View>
              </Section>
            </View>
          </View>
        </View>
      </ScrollView>

      <View style={styles.bottomBar}>
        <View style={styles.bottomBarInner}>
          <AppButton
            label={submitting ? 'Creating tournament…' : 'Create tournament'}
            disabled={submitting}
            onPress={() => void handleCreate()}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <View style={{ gap: 4 }}>
        <Text style={styles.sectionLabel}>{title}</Text>
        {subtitle ? <Text style={styles.helperText}>{subtitle}</Text> : null}
      </View>
      {children}
    </View>
  );
}

function SegmentRow<V extends number>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: V;
  options: { v: V; label: string }[];
  onChange: (v: V) => void;
}) {
  return (
    <View style={{ gap: 8 }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.segmented}>
        {options.map(({ v, label: l }) => {
          const active = value === v;
          return (
            <Pressable
              key={v}
              style={[styles.segment, active && styles.segmentActive]}
              onPress={() => onChange(v)}
            >
              <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{l}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.background,
  },
  scroll: {
    paddingBottom: 120,
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
    color: theme.colors.accent,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.8,
    textTransform: 'uppercase',
  },
  heroTitle: {
    color: theme.colors.textInverse,
    fontSize: 44,
    fontWeight: '900',
    letterSpacing: -1.2,
    lineHeight: 48,
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
    maxWidth: 1200,
    alignSelf: 'center',
  },
  splitLayout: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: theme.spacing.xl,
  },
  column: {
    gap: theme.spacing.lg,
  },
  columnFlex: { flex: 1 },

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
    letterSpacing: 1.2,
    fontSize: 12,
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
    fontSize: 13,
    lineHeight: 18,
  },

  optionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  optionGridError: {
    borderWidth: 1,
    borderColor: theme.colors.danger,
    padding: 8,
    backgroundColor: theme.colors.dangerSoft,
  },
  optionChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: theme.radius.full,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  optionChipSelected: {
    borderColor: theme.colors.text,
    backgroundColor: theme.colors.text,
  },
  optionChipText: {
    color: theme.colors.text,
    fontWeight: '700',
    fontSize: 13,
    letterSpacing: 0.4,
  },
  optionChipTextSelected: {
    color: theme.colors.textInverse,
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

  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    paddingTop: theme.spacing.md,
    marginTop: 4,
  },
  pinRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    alignItems: 'flex-end',
  },

  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: theme.colors.surface,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    paddingHorizontal: theme.spacing.xl,
    paddingTop: 12,
    paddingBottom: 16,
  },
  bottomBarInner: {
    width: '100%',
    maxWidth: 1200,
    alignSelf: 'center',
  },

  errorText: {
    color: theme.colors.danger,
    fontWeight: '700',
    fontSize: 13,
    backgroundColor: theme.colors.dangerSoft,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderLeftWidth: 3,
    borderLeftColor: theme.colors.danger,
  },
  successBox: {
    backgroundColor: theme.colors.successSoft,
    borderLeftWidth: 3,
    borderLeftColor: theme.colors.success,
    padding: 12,
    gap: 4,
  },
  successTitle: {
    color: theme.colors.text,
    fontWeight: '900',
    fontSize: 14,
  },
  successMeta: {
    color: theme.colors.textMuted,
    fontWeight: '700',
    fontSize: 12,
  },
  successLink: {
    marginTop: 4,
    color: theme.colors.text,
    fontWeight: '900',
    textDecorationLine: 'underline',
  },

  authBlocked: {
    flex: 1,
    alignItems: 'flex-start',
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.xl,
    gap: 10,
    maxWidth: 480,
    alignSelf: 'center',
  },
  eyebrow: {
    color: theme.colors.textMuted,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
  title: {
    color: theme.colors.text,
    fontSize: 36,
    fontWeight: '900',
    letterSpacing: -1,
  },
  authBlockedText: {
    color: theme.colors.textMuted,
    fontWeight: '500',
    lineHeight: 22,
    fontSize: 15,
  },

  fieldErrorText: {
    color: theme.colors.danger,
    fontSize: 12,
    fontWeight: '700',
    marginTop: -2,
  },
});
