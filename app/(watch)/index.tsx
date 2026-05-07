import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { theme } from '@/constants/theme';
import { subscribeToPublicTournaments } from '@/lib/firestore/tournaments';
import { type TournamentDocument, type TournamentStatus } from '@/lib/firestore/types';

function statusLabel(status: TournamentStatus): string {
  if (status === 'group_stage' || status === 'knockout') return 'Live';
  if (status === 'completed') return 'Completed';
  return 'Upcoming';
}

function statusColor(status: TournamentStatus): string {
  if (status === 'group_stage' || status === 'knockout') return '#10B981';
  if (status === 'completed') return '#64748B';
  return '#3B82F6';
}

export default function WatchJoinScreen() {
  const [idInput, setIdInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [publicTournaments, setPublicTournaments] = useState<TournamentDocument[]>([]);
  const [loadingPublic, setLoadingPublic] = useState(true);

  useEffect(() => {
    const unsubscribe = subscribeToPublicTournaments((docs) => {
      setPublicTournaments(docs);
      setLoadingPublic(false);
    });
    return unsubscribe;
  }, []);

  const handleJoinById = () => {
    const trimmed = idInput.trim();
    if (!trimmed) {
      setError('Please enter a tournament ID.');
      return;
    }
    setError(null);
    router.push(`/(watch)/${trimmed}?mode=id` as any);
  };

  const handleOpenPublicTournament = (tournament: TournamentDocument) => {
    router.push(`/(watch)/${tournament.slug}` as any);
  };

  // Separate active (live) vs others
  const activeTournaments = publicTournaments.filter(
    (t) => t.status === 'group_stage' || t.status === 'knockout',
  );
  const otherTournaments = publicTournaments.filter(
    (t) => t.status !== 'group_stage' && t.status !== 'knockout',
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <KeyboardAvoidingView
          style={styles.container}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          {/* Header */}
          <View style={styles.logoArea}>
            <Text style={styles.emoji}>🏸</Text>
            <Text style={styles.title}>Watch Party</Text>
            <Text style={styles.subtitle}>
              Follow live badminton scores
            </Text>
          </View>

          {/* Private tournament access */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Join Private Tournament</Text>
            <Text style={styles.sectionHint}>Enter the tournament ID shared by the organizer</Text>
            {error ? <Text style={styles.errorText}>{error}</Text> : null}
            <View style={styles.inputRow}>
              <View style={styles.inputContainer}>
                <TextInput
                  style={styles.input}
                  placeholder="Tournament ID"
                  placeholderTextColor="#475569"
                  value={idInput}
                  onChangeText={(text) => {
                    setIdInput(text);
                    if (error) setError(null);
                  }}
                  onSubmitEditing={handleJoinById}
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="go"
                />
              </View>
              <Pressable
                style={({ pressed }) => [styles.joinButton, pressed && styles.joinButtonPressed]}
                onPress={handleJoinById}
              >
                <Text style={styles.joinButtonText}>Join</Text>
              </Pressable>
            </View>
          </View>

          {/* Public tournaments */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Public Tournaments</Text>
            <Text style={styles.sectionHint}>Browse tournaments open to everyone</Text>

            {loadingPublic ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator size="small" color="#10B981" />
                <Text style={styles.loadingText}>Loading tournaments...</Text>
              </View>
            ) : publicTournaments.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>No public tournaments available right now.</Text>
              </View>
            ) : (
              <View style={styles.tournamentList}>
                {/* Active tournaments first */}
                {activeTournaments.map((tournament) => (
                  <Pressable
                    key={tournament.id}
                    style={({ pressed }) => [
                      styles.tournamentRow,
                      styles.tournamentRowActive,
                      pressed && styles.tournamentRowPressed,
                    ]}
                    onPress={() => handleOpenPublicTournament(tournament)}
                  >
                    <View style={styles.tournamentInfo}>
                      <Text style={styles.tournamentName} numberOfLines={1}>
                        {tournament.name}
                      </Text>
                      <Text style={styles.tournamentMeta}>
                        {tournament.categories.join(' · ')} · {tournament.status === 'group_stage' ? 'Groups' : 'Knockout'}
                      </Text>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: `${statusColor(tournament.status)}20`, borderColor: `${statusColor(tournament.status)}60` }]}>
                      <View style={[styles.statusDot, { backgroundColor: statusColor(tournament.status) }]} />
                      <Text style={[styles.statusText, { color: statusColor(tournament.status) }]}>
                        {statusLabel(tournament.status)}
                      </Text>
                    </View>
                  </Pressable>
                ))}
                {/* Other (completed, draft) */}
                {otherTournaments.map((tournament) => (
                  <Pressable
                    key={tournament.id}
                    style={({ pressed }) => [
                      styles.tournamentRow,
                      pressed && styles.tournamentRowPressed,
                    ]}
                    onPress={() => handleOpenPublicTournament(tournament)}
                  >
                    <View style={styles.tournamentInfo}>
                      <Text style={styles.tournamentName} numberOfLines={1}>
                        {tournament.name}
                      </Text>
                      <Text style={styles.tournamentMeta}>
                        {tournament.categories.join(' · ')}
                      </Text>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: `${statusColor(tournament.status)}20`, borderColor: `${statusColor(tournament.status)}60` }]}>
                      <Text style={[styles.statusText, { color: statusColor(tournament.status) }]}>
                        {statusLabel(tournament.status)}
                      </Text>
                    </View>
                  </Pressable>
                ))}
              </View>
            )}
          </View>
        </KeyboardAvoidingView>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scrollContent: {
    flexGrow: 1,
  },
  container: {
    flex: 1,
    padding: 24,
    gap: 28,
    maxWidth: 520,
    width: '100%',
    alignSelf: 'center',
  },
  logoArea: {
    alignItems: 'center',
    gap: 6,
    paddingTop: 20,
  },
  emoji: {
    fontSize: 56,
    marginBottom: 4,
  },
  title: {
    fontSize: 30,
    fontWeight: '900',
    color: '#F8FAFC',
    letterSpacing: -1,
  },
  subtitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#64748B',
    textAlign: 'center',
  },

  // Sections
  section: {
    gap: 8,
  },
  sectionTitle: {
    color: '#E2E8F0',
    fontSize: 17,
    fontWeight: '800',
  },
  sectionHint: {
    color: '#64748B',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 2,
  },
  errorText: {
    color: '#EF4444',
    fontWeight: '700',
    fontSize: 13,
  },

  // Input row
  inputRow: {
    flexDirection: 'row',
    gap: 8,
  },
  inputContainer: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    backgroundColor: 'rgba(30, 41, 59, 0.7)',
    overflow: 'hidden',
    ...(typeof window !== 'undefined' && {
      backdropFilter: 'blur(12px)',
    }),
  },
  input: {
    color: '#F8FAFC',
    fontSize: 15,
    fontWeight: '700',
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  joinButton: {
    backgroundColor: '#10B981',
    borderRadius: 14,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
    ...(typeof window !== 'undefined' && {
      boxShadow: '0 4px 16px rgba(16, 185, 129, 0.25)',
      cursor: 'pointer',
    }),
  },
  joinButtonPressed: {
    opacity: 0.85,
  },
  joinButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
  },

  // Loading
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 16,
    justifyContent: 'center',
  },
  loadingText: {
    color: '#64748B',
    fontSize: 13,
    fontWeight: '600',
  },

  // Empty
  emptyState: {
    backgroundColor: 'rgba(30, 41, 59, 0.4)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    padding: 20,
    alignItems: 'center',
  },
  emptyText: {
    color: '#475569',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },

  // Tournament list
  tournamentList: {
    gap: 4,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    backgroundColor: 'rgba(30, 41, 59, 0.4)',
    overflow: 'hidden',
  },
  tournamentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.04)',
    ...(typeof window !== 'undefined' && {
      cursor: 'pointer',
      transition: 'background-color 0.15s ease',
    }),
  },
  tournamentRowActive: {
    backgroundColor: 'rgba(16, 185, 129, 0.04)',
  },
  tournamentRowPressed: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
  },
  tournamentInfo: {
    flex: 1,
    gap: 2,
  },
  tournamentName: {
    color: '#F8FAFC',
    fontSize: 15,
    fontWeight: '800',
  },
  tournamentMeta: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '600',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '800',
  },
});
