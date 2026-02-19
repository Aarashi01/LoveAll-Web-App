import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Link, router } from 'expo-router';
import { type FirebaseError } from 'firebase/app';

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
      Alert.alert('Missing name', 'Please enter a tournament name.');
      return;
    }

    if (categories.length === 0) {
      Alert.alert('No categories selected', 'Select at least one category.');
      return;
    }

    const parsedGroupCount = Number(groupCount);
    if (!Number.isFinite(parsedGroupCount) || parsedGroupCount <= 0) {
      Alert.alert('Invalid group count', 'Group count must be a positive number.');
      return;
    }

    if (!/^\d{4}$/.test(venuePin)) {
      Alert.alert('Invalid PIN', 'Venue PIN must be 4 digits.');
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
          <Link href="/(auth)/login" style={styles.loginLink}>
            Go to Login
          </Link>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
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

        <View style={styles.card}>
          <Text style={styles.sectionLabel}>Tournament Details</Text>
          <Text style={styles.fieldLabel}>Tournament Name</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Enter Tournament Name"
            style={styles.input}
          />

          <View style={styles.switchRow}>
            <Text style={styles.fieldLabel}>Enable Public Spectator View</Text>
            <Switch value={publicViewEnabled} onValueChange={setPublicViewEnabled} />
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionLabel}>Match Categories</Text>
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
                    {category}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionLabel}>Scoring Format</Text>
          <Text style={styles.fieldLabel}>Best Of</Text>
          <View style={styles.segmented}>
            {[1, 3].map((value) => (
              <Pressable
                key={value}
                style={[styles.segment, bestOf === value && styles.segmentActive]}
                onPress={() => setBestOf(value as 1 | 3)}
              >
                <Text style={[styles.segmentText, bestOf === value && styles.segmentTextActive]}>
                  Best of {value}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={[styles.fieldLabel, styles.fieldTopGap]}>Points Per Game</Text>
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
                  {value} pts
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionLabel}>Draw Structure</Text>
          <Text style={styles.fieldLabel}>Group Count</Text>
          <TextInput
            value={groupCount}
            onChangeText={setGroupCount}
            keyboardType="number-pad"
            style={styles.input}
          />

          <Text style={[styles.fieldLabel, styles.fieldTopGap]}>Knockout Size</Text>
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
                  {value}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={[styles.fieldLabel, styles.fieldTopGap]}>Venue PIN (4 digits)</Text>
          <View style={styles.pinRow}>
            <TextInput
              value={venuePin}
              onChangeText={setVenuePin}
              maxLength={4}
              keyboardType="number-pad"
              style={[styles.input, styles.pinInput]}
            />
            <Pressable style={styles.regenerateButton} onPress={() => setVenuePin(randomPin())}>
              <Text style={styles.regenerateButtonText}>Regenerate</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>

      <View style={styles.bottomBar}>
        <Pressable
          style={[styles.createButton, submitting && styles.createButtonDisabled]}
          disabled={submitting}
          onPress={() => void handleCreate()}
        >
          <Text style={styles.createButtonText}>
            {submitting ? 'Creating Tournament...' : 'Create Tournament'}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F1F4F8',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1F4F8',
  },
  content: {
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 120,
    gap: 12,
  },
  screenTitle: {
    fontSize: 30,
    fontWeight: '900',
    color: '#0F172A',
  },
  subtitle: {
    color: '#64748B',
    fontWeight: '600',
    marginTop: -4,
    marginBottom: 2,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
    gap: 10,
  },
  sectionLabel: {
    color: '#64748B',
    fontWeight: '900',
    letterSpacing: 0.8,
    fontSize: 12,
    textTransform: 'uppercase',
  },
  fieldLabel: {
    color: '#334155',
    fontWeight: '800',
  },
  fieldTopGap: {
    marginTop: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  optionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  optionCard: {
    minWidth: 56,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 12,
    paddingVertical: 10,
    alignItems: 'center',
  },
  optionCardSelected: {
    borderColor: '#3B82F6',
    backgroundColor: '#EAF2FF',
  },
  optionCardText: {
    color: '#334155',
    fontWeight: '800',
  },
  optionCardTextSelected: {
    color: '#1D4ED8',
  },
  segmented: {
    backgroundColor: '#E2E8F0',
    borderRadius: 12,
    padding: 4,
    flexDirection: 'row',
    gap: 4,
  },
  segment: {
    flex: 1,
    minHeight: 42,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentActive: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#3B82F6',
  },
  segmentText: {
    color: '#334155',
    fontWeight: '800',
    fontSize: 13,
  },
  segmentTextActive: {
    color: '#1D4ED8',
  },
  pinRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  pinInput: {
    flex: 1,
  },
  regenerateButton: {
    minHeight: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  regenerateButtonText: {
    color: '#0F172A',
    fontWeight: '700',
  },
  switchRow: {
    marginTop: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#F1F4F8',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 14,
  },
  createButton: {
    minHeight: 52,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2F80ED',
  },
  createButtonDisabled: {
    opacity: 0.55,
  },
  createButtonText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 17,
  },
  errorText: {
    color: '#B91C1C',
    fontWeight: '700',
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 10,
    padding: 10,
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
    color: '#334155',
    fontWeight: '600',
  },
  loginLink: {
    color: '#166534',
    fontWeight: '800',
    backgroundColor: '#DCFCE7',
    borderColor: '#86EFAC',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    overflow: 'hidden',
  },
});

