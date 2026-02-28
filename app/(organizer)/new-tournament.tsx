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
  useWindowDimensions
} from 'react-native';

import { AppButton } from '@/components/ui/AppButton';
import { AppCard } from '@/components/ui/AppCard';
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

    if (!name.trim()) {
      setFormError('Please enter a tournament name.');
      return;
    }

    if (categories.length === 0) {
      setFormError('Select at least one category.');
      return;
    }

    const parsedGroupCount = Number(groupCount);
    if (!Number.isFinite(parsedGroupCount) || parsedGroupCount <= 0) {
      setFormError('Group count must be a positive number.');
      return;
    }

    if (!/^\d{4}$/.test(venuePin)) {
      setFormError('Venue PIN must be 4 digits.');
      return;
    }

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
      router.replace({
        pathname: '/(organizer)/[id]/manage',
        params: { id: tournamentId },
      });
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
        <ActivityIndicator size="large" />
      </SafeAreaView>
    );
  }

  if (!organizerUser) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.authBlocked}>
          <Text style={styles.screenTitle}>Create Tournament</Text>
          <Text style={styles.authBlockedText}>
            You must be logged in as an organizer to create a tournament.
          </Text>
          <AppButton label="Go to Login" onPress={() => router.push('/(auth)/login')} />
        </View>
      </SafeAreaView>
    );
  }



  return (
    <SafeAreaView style={styles.safeArea}>
      <View pointerEvents="none" style={styles.backgroundLayer}>
        <View style={[styles.glowOrb, styles.glowOrbTop]} />
        <View style={[styles.glowOrb, styles.glowOrbBottom]} />
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.screenTitle}>Tournament Setup</Text>
        <Text style={styles.subtitle}>Configure format and structure before creating.</Text>

        {formError ? <Text style={styles.errorText}>{formError}</Text> : null}
        {createdTournamentId ? (
          <View style={styles.successBox}>
            <Text style={styles.successTitle}>Tournament created</Text>
            <Text style={styles.successMeta}>ID: {createdTournamentId}</Text>
            <Link
              href={{ pathname: '/(organizer)/[id]/manage', params: { id: createdTournamentId } }}
              style={styles.successLink}
            >
              Go to Manage
            </Link>
          </View>
        ) : null}


        <View style={isWide && styles.splitLayout}>
          <View style={[styles.leftColumn, isWide && { flex: 1 }]}>
            <AppCard>
              <Text style={styles.sectionLabel}>Tournament Details</Text>
              <AppInput
                label="Tournament Name"
                value={name}
                onChangeText={setName}
                placeholder="Enter Tournament Name"
              />

              <View style={styles.switchRow}>
                <Text style={styles.fieldLabel}>Enable Public Spectator View</Text>
                <Switch value={publicViewEnabled} onValueChange={setPublicViewEnabled} />
              </View>
            </AppCard>

            <AppCard>
              <Text style={styles.sectionLabel}>Match Categories</Text>
              <Text style={styles.helperText}>Select all event types available in this tournament.</Text>
              <View style={styles.optionGrid}>
                {CATEGORY_OPTIONS.map((category) => {
                  const selected = categories.includes(category);
                  return (
                    <Pressable
                      key={category}
                      style={[styles.optionCard, selected && styles.optionCardSelected]}
                      onPress={() => toggleCategory(category)}
                    >
                      <Text style={[styles.optionCardText, selected && styles.optionCardTextSelected]}>
                        {toCategoryLabel(category)}
                      </Text>
                      {selected && <View style={styles.selectedIndicator} />}
                    </Pressable>
                  );
                })}
              </View>
            </AppCard>
          </View>

          <View style={[styles.rightColumn, isWide && { flex: 1 }]}>
            <AppCard>
              <Text style={styles.sectionLabel}>Scoring Format</Text>
              <Text style={styles.fieldLabel}>Match Length</Text>
              <View style={styles.segmented}>
                {[1, 3].map((value) => (
                  <Pressable
                    key={value}
                    style={[styles.segment, bestOf === value && styles.segmentActive]}
                    onPress={() => setBestOf(value as 1 | 3)}
                  >
                    <Text style={[styles.segmentText, bestOf === value && styles.segmentTextActive]}>
                      {value === 1 ? 'Single Set' : 'Best of 3 Sets'}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <Text style={[styles.fieldLabel, styles.fieldTopGap]}>Points Required to win</Text>
              <View style={styles.segmented}>
                {[11, 15, 21].map((value) => (
                  <Pressable
                    key={value}
                    style={[styles.segment, pointsPerGame === value && styles.segmentActive]}
                    onPress={() => setPointsPerGame(value as 11 | 15 | 21)}
                  >
                    <Text
                      style={[
                        styles.segmentText,
                        pointsPerGame === value && styles.segmentTextActive,
                      ]}
                    >
                      {value} points
                    </Text>
                  </Pressable>
                ))}
              </View>
            </AppCard>

            <AppCard>
              <Text style={styles.sectionLabel}>Draw Structure</Text>
              <AppInput
                label="Number of Groups"
                value={groupCount}
                onChangeText={setGroupCount}
                keyboardType="number-pad"
              />

              <Text style={[styles.fieldLabel, styles.fieldTopGap]}>Knockout Bracket Size</Text>
              <View style={styles.segmented}>
                {[4, 8, 16].map((value) => (
                  <Pressable
                    key={value}
                    style={[styles.segment, knockoutSize === value && styles.segmentActive]}
                    onPress={() => setKnockoutSize(value as 16 | 8 | 4)}
                  >
                    <Text
                      style={[
                        styles.segmentText,
                        knockoutSize === value && styles.segmentTextActive,
                      ]}
                    >
                      {value} Players
                    </Text>
                  </Pressable>
                ))}
              </View>

              <View style={styles.pinRow}>
                <AppInput
                  label="Venue Access PIN (4 digits)"
                  value={venuePin}
                  onChangeText={setVenuePin}
                  maxLength={4}
                  keyboardType="number-pad"
                  containerStyle={styles.pinInput}
                />
                <AppButton
                  variant="secondary"
                  label="Regenerate"
                  onPress={() => setVenuePin(randomPin())}
                />
              </View>
            </AppCard>
          </View>
        </View>
      </ScrollView>

      <View style={styles.bottomBar}>
        <AppButton
          label={submitting ? 'Creating Tournament...' : 'Create Tournament'}
          disabled={submitting}
          onPress={() => void handleCreate()}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  backgroundLayer: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  glowOrb: {
    position: 'absolute',
    borderRadius: theme.radius.full,
    opacity: 0.15,
    ...(typeof window !== 'undefined' && {
      filter: 'blur(100px)',
    }),
  },
  glowOrbTop: {
    width: 600,
    height: 600,
    top: -200,
    right: -200,
    backgroundColor: '#3B82F6', // Deep vibrant blue
  },
  glowOrbBottom: {
    width: 400,
    height: 400,
    bottom: -100,
    left: -150,
    backgroundColor: '#8B5CF6', // Purple
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.background,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 120,
    gap: 16,
    width: '100%',
    maxWidth: 1200,
    alignSelf: 'center',
  },
  splitLayout: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 24,
  },
  leftColumn: {
    gap: 24,
  },
  rightColumn: {
    gap: 24,
  },
  screenTitle: {
    fontSize: 30,
    fontWeight: '900',
    color: theme.colors.text,
  },
  subtitle: {
    color: theme.colors.textMuted,
    fontWeight: '600',
    marginTop: -4,
    marginBottom: 2,
  },
  sectionLabel: {
    color: '#94A3B8', // Slate 400
    fontWeight: '800',
    letterSpacing: 1.2,
    fontSize: 12,
    textTransform: 'uppercase',
  },
  fieldLabel: {
    color: '#E2E8F0', // Slate 200
    fontWeight: '700',
    fontSize: 14,
  },
  helperText: {
    color: '#94A3B8',
    fontWeight: '500',
    fontSize: 13,
  },
  fieldTopGap: {
    marginTop: 4,
  },
  optionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  optionCard: {
    minWidth: 160,
    flexGrow: 1,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 14,
    backgroundColor: 'rgba(30, 41, 59, 0.5)', // Slate 800
    paddingHorizontal: 16,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  optionCardSelected: {
    borderColor: 'rgba(59, 130, 246, 0.5)', // Blue 500
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
  },
  optionCardText: {
    color: '#CBD5E1', // Slate 300
    fontWeight: '700',
    fontSize: 15,
  },
  optionCardTextSelected: {
    color: '#60A5FA', // Bright Blue
    fontWeight: '800',
  },
  selectedIndicator: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    width: 4,
    backgroundColor: '#3B82F6',
  },
  segmented: {
    backgroundColor: 'rgba(15, 23, 42, 0.6)', // Slate 900
    borderRadius: 12,
    padding: 4,
    flexDirection: 'row',
    gap: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  segment: {
    flex: 1,
    minHeight: 46,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentActive: {
    backgroundColor: 'rgba(59, 130, 246, 0.15)', // Blue 500 with opacity
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.4)',
    ...(typeof window !== 'undefined' && {
      boxShadow: '0 2px 8px rgba(59, 130, 246, 0.2)',
    }),
  },
  segmentText: {
    color: '#94A3B8',
    fontWeight: '600',
    fontSize: 14,
  },
  segmentTextActive: {
    color: '#60A5FA', // Bright Blue
    fontWeight: '800',
  },
  pinRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-end',
  },
  pinInput: {
    flex: 1,
  },
  switchRow: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 14,
    backgroundColor: 'rgba(30, 41, 59, 0.5)',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.8)', // Slate 900
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 24,
    ...(typeof window !== 'undefined' && {
      backdropFilter: 'blur(16px)',
    }),
  },
  errorText: {
    color: theme.colors.danger,
    fontWeight: '700',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    borderRadius: 10,
    padding: 12,
  },
  successBox: {
    borderWidth: 1,
    borderColor: '#86EFAC',
    backgroundColor: '#DCFCE7',
    borderRadius: 10,
    padding: 10,
    gap: 4,
  },
  successTitle: {
    color: '#166534',
    fontWeight: '900',
  },
  successMeta: {
    color: '#166534',
    fontWeight: '700',
    fontSize: 12,
  },
  successLink: {
    marginTop: 4,
    color: '#14532D',
    fontWeight: '900',
  },
  authBlocked: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 10,
  },
  authBlockedText: {
    textAlign: 'center',
    color: theme.colors.text,
    fontWeight: '600',
  },
});
