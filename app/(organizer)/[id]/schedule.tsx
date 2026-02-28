import { Link, router, useLocalSearchParams } from 'expo-router';
import { Timestamp } from 'firebase/firestore';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';

import { AppButton } from '@/components/ui/AppButton';
import { AppCard } from '@/components/ui/AppCard';
import { AppInput } from '@/components/ui/AppInput';
import { theme, toCategoryLabel, toRoundLabel } from '@/constants/theme';
import { useMatches } from '@/hooks/useMatches';
import { useTournament } from '@/hooks/useTournament';
import {
  addMatch,
  deleteAllMatches,
  deleteKnockoutMatches,
  updateMatch,
  updateMatchStatus,
} from '@/lib/firestore/matches';
import { subscribeToPlayers } from '@/lib/firestore/players';
import { updateTournament } from '@/lib/firestore/tournaments';
import {
  type CreateMatchInput,
  type MatchCategory,
  type MatchDocument,
  type MatchRound,
  type MatchStatus,
  type PlayerDocument,
} from '@/lib/firestore/types';
import { calculateStandings, generateGroupMatches, generateKnockoutMatches } from '@/lib/schedule-generator';

type ScheduleNotice = {
  type: 'error' | 'success';
  message: string;
};

const KNOCKOUT_ROUNDS: MatchRound[] = ['R16', 'QF', 'SF', 'F', '3rd'];
const MATCH_STATUS_OPTIONS: Array<'all' | MatchStatus> = ['all', 'scheduled', 'live', 'completed', 'walkover'];

function parsePositiveNumber(raw: string, fallback: number): number {
  const value = Number(raw.trim());
  if (!Number.isFinite(value) || value <= 0) return fallback;
  return Math.floor(value);
}

function matchTimeLabel(match: MatchDocument): string {
  if (!match.scheduledTime || typeof match.scheduledTime.toDate !== 'function') return 'Unscheduled';
  return match.scheduledTime.toDate().toLocaleString();
}

function resolveBracketSize(qualifierCount: number, preferred: 16 | 8 | 4): 16 | 8 | 4 {
  const capped = Math.min(qualifierCount, preferred);
  if (capped > 8) return 16;
  if (capped > 4) return 8;
  return 4;
}

function knockoutRoundsForSize(size: 16 | 8 | 4): MatchRound[] {
  if (size === 16) return ['R16', 'QF', 'SF', 'F'];
  if (size === 8) return ['QF', 'SF', 'F'];
  return ['SF', 'F'];
}

function emptyScoreGame() {
  return {
    gameNumber: 1,
    p1Score: 0,
    p2Score: 0,
    winner: null,
    startedAt: null,
    endedAt: null,
  } as const;
}

function emptyKnockoutMatch(category: MatchCategory, round: MatchRound): CreateMatchInput {
  return {
    category,
    round,
    groupId: null,
    player1Id: 'TBD',
    player2Id: 'TBD',
    player1Name: 'TBD',
    player2Name: 'TBD',
    status: 'scheduled',
    scores: [emptyScoreGame()],
  };
}

function isKnockoutRound(round: MatchRound): boolean {
  return KNOCKOUT_ROUNDS.includes(round);
}

function dedupePlayers(players: Array<{ id: string; name: string }>): Array<{ id: string; name: string }> {
  const seen = new Set<string>();
  const output: Array<{ id: string; name: string }> = [];

  players.forEach((player) => {
    if (seen.has(player.id)) return;
    seen.add(player.id);
    output.push(player);
  });

  return output;
}

function pickKnockoutQualifiers(
  players: PlayerDocument[],
  matches: MatchDocument[],
  category: MatchCategory,
  knockoutSize: 16 | 8 | 4,
): Array<{ id: string; name: string }> {
  const categoryPlayers = players.filter((player) => player.categories.includes(category));
  const categoryMatches = matches.filter((match) => match.category === category && match.round === 'group');
  const groupIds = Array.from(
    new Set(categoryMatches.map((match) => match.groupId).filter((value): value is string => Boolean(value))),
  );

  const qualifiers: Array<{ id: string; name: string }> = [];
  const winners: string[] = [];
  const rankingPool: Array<{ id: string; name: string; points: number; wins: number; losses: number }> = [];

  groupIds.forEach((groupId) => {
    const standings = calculateStandings(categoryMatches, groupId);
    if (standings.length === 0) return;

    winners.push(standings[0].id);
    qualifiers.push({ id: standings[0].id, name: standings[0].name });

    standings.slice(1).forEach((row) => {
      rankingPool.push({
        id: row.id,
        name: row.name,
        points: row.points,
        wins: row.wins,
        losses: row.losses,
      });
    });
  });

  const winnerSet = new Set(winners);
  rankingPool
    .filter((row) => !winnerSet.has(row.id))
    .sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.wins !== a.wins) return b.wins - a.wins;
      if (a.losses !== b.losses) return a.losses - b.losses;
      return a.name.localeCompare(b.name);
    })
    .forEach((row) => qualifiers.push({ id: row.id, name: row.name }));

  const selectedIds = new Set(qualifiers.map((player) => player.id));
  categoryPlayers
    .filter((player) => !selectedIds.has(player.id))
    .sort((a, b) => {
      if (a.seeded !== b.seeded) return a.seeded ? -1 : 1;
      return a.name.localeCompare(b.name);
    })
    .forEach((player) => qualifiers.push({ id: player.id, name: player.name }));

  return dedupePlayers(qualifiers).slice(0, knockoutSize);
}

async function confirmAction(title: string, message: string): Promise<boolean> {
  if (Platform.OS === 'web' && typeof globalThis.confirm === 'function') {
    return globalThis.confirm(message);
  }

  return new Promise<boolean>((resolve) => {
    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
      { text: 'Continue', style: 'default', onPress: () => resolve(true) },
    ]);
  });
}

export default function TournamentScheduleScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { tournament, loading: tournamentLoading, error: tournamentError } = useTournament(id);
  const { matches, loading: matchesLoading, error: matchesError } = useMatches(id);

  const [players, setPlayers] = useState<PlayerDocument[]>([]);
  const [playersLoading, setPlayersLoading] = useState(true);
  const [courtsCountInput, setCourtsCountInput] = useState('4');
  const [slotMinutesInput, setSlotMinutesInput] = useState('20');
  const [activeCategory, setActiveCategory] = useState<'all' | MatchCategory>('all');
  const [activeStatus, setActiveStatus] = useState<'all' | MatchStatus>('all');
  const [busyAction, setBusyAction] = useState<'group' | 'knockout' | null>(null);
  const [notice, setNotice] = useState<ScheduleNotice | null>(null);

  const { width } = useWindowDimensions();
  const isWide = width >= 1024;

  useEffect(() => {
    if (!id) {
      setPlayers([]);
      setPlayersLoading(false);
      return;
    }

    const unsubscribe = subscribeToPlayers(id, (nextPlayers) => {
      setPlayers(nextPlayers);
      setPlayersLoading(false);
    });

    return unsubscribe;
  }, [id]);

  const loading = tournamentLoading || matchesLoading || playersLoading;
  const groupMatches = useMemo(() => matches.filter((match) => match.round === 'group'), [matches]);
  const knockoutMatches = useMemo(
    () => matches.filter((match) => isKnockoutRound(match.round)),
    [matches],
  );
  const completedCount = useMemo(
    () => matches.filter((match) => match.status === 'completed').length,
    [matches],
  );
  const filteredMatches = useMemo(
    () =>
      matches.filter((match) => {
        if (activeCategory !== 'all' && match.category !== activeCategory) return false;
        if (activeStatus !== 'all' && match.status !== activeStatus) return false;
        return true;
      }),
    [activeCategory, activeStatus, matches],
  );

  const categoryPlayerStats = useMemo(() => {
    const rows = tournament?.categories.map((category) => {
      const count = players.filter((player) => player.categories.includes(category)).length;
      return { category, count };
    });
    return rows ?? [];
  }, [players, tournament?.categories]);

  const handleGenerateGroups = async () => {
    if (!id || !tournament) return;
    setNotice(null);

    const courtsCount = parsePositiveNumber(courtsCountInput, 4);
    const slotMinutes = parsePositiveNumber(slotMinutesInput, 20);
    const hasMatches = matches.length > 0;

    if (hasMatches) {
      const confirmed = await confirmAction(
        'Regenerate full schedule?',
        'This will delete all existing matches (group and knockout) and create new group fixtures.',
      );
      if (!confirmed) return;
    }

    try {
      setBusyAction('group');

      if (hasMatches) {
        await deleteAllMatches(id);
      }

      const groupCount = Math.max(1, tournament.groupCount);
      const startAt = new Date();
      startAt.setMinutes(startAt.getMinutes() + 10, 0, 0);

      let slotIndex = 0;
      let createdCount = 0;
      let activeCategoryCount = 0;

      for (const category of tournament.categories) {
        const categoryPlayers = players
          .filter((player) => player.categories.includes(category))
          .map((player) => ({ id: player.id, name: player.name }));

        if (categoryPlayers.length < 2) continue;

        activeCategoryCount += 1;
        const groupSize = Math.max(2, Math.ceil(categoryPlayers.length / groupCount));
        const generatedMatches = generateGroupMatches(categoryPlayers, category, groupSize);

        for (const generated of generatedMatches) {
          const scheduledTime = Timestamp.fromDate(
            new Date(startAt.getTime() + slotIndex * slotMinutes * 60_000),
          );
          const courtNumber = (slotIndex % courtsCount) + 1;

          await addMatch(id, {
            ...generated,
            scheduledTime,
            courtNumber,
            status: 'scheduled',
          });

          slotIndex += 1;
          createdCount += 1;
        }
      }

      if (createdCount === 0) {
        setNotice({
          type: 'error',
          message: 'No group fixtures were created. Add more players per category first.',
        });
        return;
      }

      await updateTournament(id, { status: 'group_stage' });
      setNotice({
        type: 'success',
        message: `Generated ${createdCount} group matches across ${activeCategoryCount} categories.`,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to generate group fixtures.';
      setNotice({ type: 'error', message });
    } finally {
      setBusyAction(null);
    }
  };

  const handleGenerateKnockout = async () => {
    if (!id || !tournament) return;
    setNotice(null);

    if (players.length < 2) {
      setNotice({ type: 'error', message: 'Add players before generating knockout rounds.' });
      return;
    }

    if (knockoutMatches.length > 0) {
      const confirmed = await confirmAction(
        'Regenerate knockout bracket?',
        'Existing knockout matches will be deleted and regenerated.',
      );
      if (!confirmed) return;
    }

    try {
      setBusyAction('knockout');

      if (knockoutMatches.length > 0) {
        await deleteKnockoutMatches(id);
      }

      let createdKnockoutMatches = 0;
      const skippedCategories: string[] = [];

      for (const category of tournament.categories) {
        const qualifiers = pickKnockoutQualifiers(players, matches, category, tournament.knockoutSize);
        if (qualifiers.length < 2) {
          skippedCategories.push(toCategoryLabel(category));
          continue;
        }

        const bracketSize = resolveBracketSize(qualifiers.length, tournament.knockoutSize);
        const seededQualifiers = qualifiers.slice(0, bracketSize);
        const rounds = knockoutRoundsForSize(bracketSize);
        const firstRound = rounds[0] as 'R16' | 'QF' | 'SF' | 'F';
        const firstRoundMatches = generateKnockoutMatches(seededQualifiers, category, firstRound);

        const roundPayloads: CreateMatchInput[][] = [firstRoundMatches];
        let matchCount = firstRoundMatches.length;

        for (let roundIndex = 1; roundIndex < rounds.length; roundIndex += 1) {
          matchCount = Math.max(1, Math.floor(matchCount / 2));
          const placeholders = Array.from({ length: matchCount }, () =>
            emptyKnockoutMatch(category, rounds[roundIndex]),
          );
          roundPayloads.push(placeholders);
        }

        const createdIdsByRound: string[][] = [];
        for (const roundMatches of roundPayloads) {
          const idsForRound: string[] = [];
          for (const payload of roundMatches) {
            const createdId = await addMatch(id, payload);
            idsForRound.push(createdId);
            createdKnockoutMatches += 1;
          }
          createdIdsByRound.push(idsForRound);
        }

        for (let roundIndex = 0; roundIndex < createdIdsByRound.length - 1; roundIndex += 1) {
          const currentRoundIds = createdIdsByRound[roundIndex];
          const nextRoundIds = createdIdsByRound[roundIndex + 1];

          for (let i = 0; i < currentRoundIds.length; i += 1) {
            const nextId = nextRoundIds[Math.floor(i / 2)];
            if (!nextId) continue;
            await updateMatch(id, currentRoundIds[i], { nextMatchId: nextId });
          }
        }
      }

      if (createdKnockoutMatches === 0) {
        setNotice({
          type: 'error',
          message: 'No knockout bracket could be created. Complete more group results or add players.',
        });
        return;
      }

      await updateTournament(id, { status: 'knockout' });
      const skippedText =
        skippedCategories.length > 0
          ? ` Skipped: ${skippedCategories.join(', ')} (insufficient qualifiers).`
          : '';
      setNotice({
        type: 'success',
        message: `Generated ${createdKnockoutMatches} knockout matches.${skippedText}`,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to generate knockout bracket.';
      setNotice({ type: 'error', message });
    } finally {
      setBusyAction(null);
    }
  };

  const handleOpenScoreEntry = (matchId: string) => {
    if (!id) return;
    router.push({
      pathname: '/(scorekeeper)/enter/[matchId]',
      params: { matchId, tournamentId: id },
    });
  };

  const handleToggleLiveStatus = async (match: MatchDocument) => {
    if (!id || match.status === 'completed') return;
    const nextStatus: MatchStatus = match.status === 'live' ? 'scheduled' : 'live';
    try {
      await updateMatchStatus(id, match.id, nextStatus);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update match status.';
      setNotice({ type: 'error', message });
    }
  };

  if (!id) {
    return (
      <SafeAreaView style={styles.centered}>
        <Text style={styles.errorText}>Missing tournament id.</Text>
      </SafeAreaView>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator size="large" />
      </SafeAreaView>
    );
  }

  if (!tournament) {
    return (
      <SafeAreaView style={styles.centered}>
        <Text style={styles.errorText}>{tournamentError ?? matchesError ?? 'Tournament not found.'}</Text>
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
        <View style={styles.header}>
          <Text style={styles.title}>Schedule Builder</Text>
          <Text style={styles.meta}>{tournament.name}</Text>
        </View>

        {notice ? (
          <View style={[styles.notice, notice.type === 'success' ? styles.noticeSuccess : styles.noticeError]}>
            <Text style={[styles.noticeText, notice.type === 'success' ? styles.noticeTextSuccess : styles.noticeTextError]}>
              {notice.message}
            </Text>
          </View>
        ) : null}

        <View style={isWide ? styles.splitLayout : undefined}>
          <View style={styles.leftColumn}>
            <AppCard>
              <Text style={styles.sectionTitle}>Overview</Text>
              <View style={styles.metricsRow}>
                <View style={styles.metricItem}>
                  <Text style={styles.metricValue}>{players.length}</Text>
                  <Text style={styles.metricLabel}>Players</Text>
                </View>
                <View style={styles.metricItem}>
                  <Text style={styles.metricValue}>{matches.length}</Text>
                  <Text style={styles.metricLabel}>Matches</Text>
                </View>
                <View style={styles.metricItem}>
                  <Text style={styles.metricValue}>{completedCount}</Text>
                  <Text style={styles.metricLabel}>Completed</Text>
                </View>
              </View>
              <Text style={styles.helperText}>
                Group: {groupMatches.length} | Knockout: {knockoutMatches.length}
              </Text>
              {categoryPlayerStats.map((row) => (
                <Text key={row.category} style={styles.categoryStat}>
                  {toCategoryLabel(row.category)}: {row.count} players
                </Text>
              ))}
            </AppCard>

            <AppCard>
              <Text style={styles.sectionTitle}>Generate Fixtures</Text>
              <View style={styles.inlineInputs}>
                <AppInput
                  label="Courts"
                  value={courtsCountInput}
                  onChangeText={setCourtsCountInput}
                  keyboardType="number-pad"
                  containerStyle={styles.inlineInput}
                />
                <AppInput
                  label="Slot Minutes"
                  value={slotMinutesInput}
                  onChangeText={setSlotMinutesInput}
                  keyboardType="number-pad"
                  containerStyle={styles.inlineInput}
                />
              </View>

              <AppButton
                label={busyAction === 'group' ? 'Generating Group Fixtures...' : 'Generate Group Fixtures'}
                onPress={() => void handleGenerateGroups()}
                disabled={busyAction !== null}
              />
              <AppButton
                variant="secondary"
                label={busyAction === 'knockout' ? 'Generating Knockout Bracket...' : 'Generate Knockout Bracket'}
                onPress={() => void handleGenerateKnockout()}
                disabled={busyAction !== null || groupMatches.length === 0}
              />
              <Text style={styles.helperText}>
                Knockout generation uses group standings when available, then fills remaining slots by seeded roster order.
              </Text>
            </AppCard>

            <AppCard>
              <Text style={styles.sectionTitle}>Filters</Text>
              <Text style={styles.filterLabel}>Category</Text>
              <View style={styles.filterChips}>
                <Pressable
                  style={[styles.chip, activeCategory === 'all' && styles.chipActive]}
                  onPress={() => setActiveCategory('all')}
                >
                  <Text style={[styles.chipText, activeCategory === 'all' && styles.chipTextActive]}>All</Text>
                </Pressable>
                {tournament.categories.map((category) => (
                  <Pressable
                    key={category}
                    style={[styles.chip, activeCategory === category && styles.chipActive]}
                    onPress={() => setActiveCategory(category)}
                  >
                    <Text style={[styles.chipText, activeCategory === category && styles.chipTextActive]}>
                      {toCategoryLabel(category)}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <Text style={styles.filterLabel}>Status</Text>
              <View style={styles.filterChips}>
                {MATCH_STATUS_OPTIONS.map((status) => (
                  <Pressable
                    key={status}
                    style={[styles.chip, activeStatus === status && styles.chipActive]}
                    onPress={() => setActiveStatus(status)}
                  >
                    <Text style={[styles.chipText, activeStatus === status && styles.chipTextActive]}>
                      {status === 'all' ? 'All' : status}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </AppCard>
          </View>

          <View style={styles.rightColumn}>
            <AppCard style={styles.matchesCard}>
              <View style={styles.matchesHeader}>
                <Text style={styles.sectionTitle}>Matches ({filteredMatches.length})</Text>
              </View>
              {filteredMatches.length === 0 ? (
                <Text style={styles.emptyText}>No matches match the current filters.</Text>
              ) : (
                <View style={styles.matchGrid}>
                  {filteredMatches.map((match) => (
                    <View key={match.id} style={styles.matchRow}>
                      <View style={styles.matchInfo}>
                        <Text style={styles.matchTitle}>
                          {toCategoryLabel(match.category)} - {toRoundLabel(match.round)}
                        </Text>
                        <Text style={styles.matchPair}>
                          {match.player1Name} vs {match.player2Name}
                        </Text>
                        <Text style={styles.matchMeta}>
                          {match.status.toUpperCase()} | Court {match.courtNumber ?? '-'} | {matchTimeLabel(match)}
                        </Text>
                      </View>
                      <View style={styles.matchActions}>
                        <AppButton
                          variant="secondary"
                          label={match.status === 'live' ? 'Pause' : 'Live'}
                          onPress={() => void handleToggleLiveStatus(match)}
                          disabled={match.status === 'completed'}
                          style={styles.matchActionButton}
                        />
                        <AppButton
                          label="Score"
                          onPress={() => handleOpenScoreEntry(match.id)}
                          style={styles.matchActionButton}
                        />
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </AppCard>
          </View>
        </View>

        <View style={styles.footerActions}>
          <AppButton
            variant="secondary"
            label="Back to Manage"
            onPress={() => router.push({ pathname: '/(organizer)/[id]/manage', params: { id } })}
          />
          <Link href={{ pathname: '/(organizer)/[id]/results', params: { id } }} style={styles.resultsLink}>
            Continue to Results
          </Link>
        </View>
      </ScrollView>
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
    width: 500,
    height: 500,
    bottom: -150,
    left: -150,
    backgroundColor: '#10B981', // Neon emerald
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.background,
    padding: 24,
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 40,
    gap: 20,
    width: '100%',
    maxWidth: 1200,
    alignSelf: 'center',
  },
  header: {
    gap: 4,
  },
  splitLayout: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 24,
  },
  leftColumn: {
    flex: 2,
    gap: 24,
  },
  rightColumn: {
    flex: 3,
    gap: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  meta: {
    marginTop: -8,
    color: '#94A3B8',
    fontWeight: '600',
    fontSize: 16,
  },
  sectionTitle: {
    color: '#F8FAFC',
    fontWeight: '900',
    fontSize: 18,
    letterSpacing: 0.5,
  },
  notice: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  noticeSuccess: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  noticeError: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  noticeText: {
    fontWeight: '700',
    fontSize: 15,
  },
  noticeTextSuccess: {
    color: '#10B981',
  },
  noticeTextError: {
    color: '#EF4444',
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  metricItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    backgroundColor: 'rgba(30, 41, 59, 0.5)',
    paddingVertical: 16,
    ...(typeof window !== 'undefined' && {
      backdropFilter: 'blur(12px)',
    }),
  },
  metricValue: {
    color: '#F8FAFC',
    fontSize: 24,
    fontWeight: '900',
  },
  metricLabel: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 4,
  },
  helperText: {
    color: '#94A3B8',
    fontWeight: '600',
    fontSize: 13,
  },
  categoryStat: {
    color: '#E2E8F0',
    fontWeight: '700',
    fontSize: 14,
  },
  inlineInputs: {
    flexDirection: 'row',
    gap: 8,
  },
  inlineInput: {
    flex: 1,
  },
  filterLabel: {
    marginTop: 8,
    color: '#E2E8F0',
    fontWeight: '800',
    fontSize: 14,
  },
  filterChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: 'rgba(30, 41, 59, 0.5)',
  },
  chipActive: {
    borderColor: 'rgba(16, 185, 129, 0.5)',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
  },
  chipText: {
    color: '#CBD5E1',
    fontWeight: '700',
    fontSize: 14,
  },
  chipTextActive: {
    color: '#10B981',
    fontWeight: '800',
  },
  matchesCard: {
    flex: 1,
  },
  matchesHeader: {
    marginBottom: 8,
  },
  matchGrid: {
    gap: 16,
  },
  matchRow: {
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 14,
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
    padding: 16,
    gap: 12,
    ...(typeof window !== 'undefined' && {
      transition: 'all 0.2s ease',
    }),
  },
  matchInfo: {
    gap: 4,
  },
  matchTitle: {
    color: '#F8FAFC',
    fontWeight: '900',
    fontSize: 16,
  },
  matchPair: {
    color: '#60A5FA',
    fontWeight: '800',
    fontSize: 15,
  },
  matchMeta: {
    color: '#94A3B8',
    fontWeight: '700',
    fontSize: 13,
  },
  matchActions: {
    flexDirection: 'row',
    gap: 8,
  },
  matchActionButton: {
    flex: 1,
  },
  emptyText: {
    color: '#94A3B8',
    fontWeight: '700',
    fontSize: 15,
    textAlign: 'center',
    padding: 24,
  },
  footerActions: {
    marginTop: 24,
    gap: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  resultsLink: {
    backgroundColor: theme.colors.focus,
    color: '#FFFFFF',
    borderRadius: 12,
    textAlign: 'center',
    paddingVertical: 14,
    paddingHorizontal: 24,
    fontWeight: '900',
    fontSize: 16,
    overflow: 'hidden',
    ...(typeof window !== 'undefined' && {
      boxShadow: '0 4px 14px 0 rgba(16, 185, 129, 0.39)',
    }),
  },
  errorText: {
    color: '#B91C1C',
    fontWeight: '700',
    textAlign: 'center',
  },
});
