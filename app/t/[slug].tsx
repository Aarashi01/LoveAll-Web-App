import { Link, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';

import { GroupStandingsTable } from '@/components/bracket/GroupStandingsTable';
import { KnockoutBracket } from '@/components/bracket/KnockoutBracket';
import { LiveScoreCard } from '@/components/score/LiveScoreCard';
import { AppCard } from '@/components/ui/AppCard';
import { theme, toCategoryLabel, toRoundLabel } from '@/constants/theme';
import { useMatches } from '@/hooks/useMatches';
import { subscribeToPublicTournamentBySlug } from '@/lib/firestore/tournaments';
import { type MatchCategory, type MatchDocument, type TournamentDocument } from '@/lib/firestore/types';
import { calculateStandings } from '@/lib/schedule-generator';

type SpectatorTab = 'live' | 'groups' | 'bracket' | 'results';

export default function SpectatorScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const [tab, setTab] = useState<SpectatorTab>('live');
  const [tournament, setTournament] = useState<TournamentDocument | null>(null);
  const [loadingTournament, setLoadingTournament] = useState(true);

  useEffect(() => {
    if (!slug) {
      setLoadingTournament(false);
      return;
    }

    const unsubscribe = subscribeToPublicTournamentBySlug(slug, (doc) => {
      setTournament(doc);
      setLoadingTournament(false);
    });
    return unsubscribe;
  }, [slug]);

  const { matches, loading: loadingMatches } = useMatches(tournament?.id);

  const liveMatches = useMemo(
    () => matches.filter((match) => match.status === 'live' || match.status === 'scheduled'),
    [matches],
  );

  const groupedMatches = useMemo(() => {
    const grouped = new Map<string, MatchDocument[]>();
    matches
      .filter((match) => match.round === 'group' && !!match.groupId)
      .forEach((match) => {
        const key = `${match.category}::${match.groupId}`;
        if (!grouped.has(key)) grouped.set(key, []);
        grouped.get(key)?.push(match);
      });
    return Array.from(grouped.entries()).map(([key, value]) => {
      const [category, groupId] = key.split('::');
      return { category, groupId, matches: value };
    });
  }, [matches]);

  const knockoutMatches = useMemo(
    () => matches.filter((match) => ['R16', 'QF', 'SF', 'F', '3rd'].includes(match.round)),
    [matches],
  );

  const visibleTabs: SpectatorTab[] =
    tournament?.status === 'completed'
      ? ['live', 'groups', 'bracket', 'results']
      : ['live', 'groups', 'bracket'];

  if (loadingTournament || loadingMatches) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator size="large" color="#10B981" />
      </SafeAreaView>
    );
  }

  if (!tournament) {
    return (
      <SafeAreaView style={styles.centered}>
        <Text style={styles.errorText}>Tournament not found or public view disabled.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Text style={styles.title}>{tournament.name}</Text>
        <Link href="/(auth)/login" style={styles.loginLink}>
          Login
        </Link>
      </View>

      <View style={styles.tabsRow}>
        {visibleTabs.map((item) => (
          <Pressable
            key={item}
            style={[styles.tabButton, tab === item && styles.tabButtonActive]}
            onPress={() => setTab(item)}
          >
            <Text style={[styles.tabLabel, tab === item && styles.tabLabelActive]}>
              {item === 'live' ? 'Live' : item[0].toUpperCase() + item.slice(1)}
            </Text>
          </Pressable>
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {tab === 'live' &&
          (liveMatches.length === 0 ? (
            <Text style={styles.emptyText}>No live matches right now.</Text>
          ) : (
            liveMatches.map((match) => <LiveScoreCard key={match.id} match={match} compact dark />)
          ))}

        {tab === 'groups' &&
          (groupedMatches.length === 0 ? (
            <Text style={styles.emptyText}>Group standings will appear once group matches start.</Text>
          ) : (
            groupedMatches.map((group) => {
              const standings = calculateStandings(group.matches, group.groupId);
              return (
                <GroupStandingsTable
                  key={`${group.category}-${group.groupId}`}
                  category={group.category as MatchCategory}
                  groupId={group.groupId}
                  standings={standings}
                />
              );
            })
          ))}

        {tab === 'bracket' &&
          (knockoutMatches.length === 0 ? (
            <Text style={styles.emptyText}>Knockout bracket is not generated yet.</Text>
          ) : (
            <KnockoutBracket matches={knockoutMatches} />
          ))}

        {tab === 'results' &&
          (matches.filter((match) => match.status === 'completed').length === 0 ? (
            <Text style={styles.emptyText}>No completed results yet.</Text>
          ) : (
            matches
              .filter((match) => match.status === 'completed')
              .map((match) => {
                const gameScores = match.scores
                  .filter((g) => g.winner !== null)
                  .map((g) => `${g.p1Score}-${g.p2Score}`)
                  .join(' · ');
                return (
                  <AppCard key={match.id} style={styles.resultItem}>
                    <Text style={styles.resultCategory}>
                      {toCategoryLabel(match.category)} · {toRoundLabel(match.round)}
                    </Text>
                    <Text style={styles.resultWinner}>
                      🏆 {match.winnerId === match.player1Id ? match.player1Name : match.player2Name}
                    </Text>
                    <Text style={styles.resultOpponent}>
                      vs {match.winnerId === match.player1Id ? match.player2Name : match.player1Name}
                    </Text>
                    {gameScores ? (
                      <Text style={styles.resultScores}>{gameScores}</Text>
                    ) : null}
                  </AppCard>
                );
              })
          ))}
      </ScrollView>
    </SafeAreaView>
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
    padding: 24,
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 8,
  },
  title: {
    fontSize: 22,
    fontWeight: '900',
    color: '#F8FAFC',
    flex: 1,
  },
  loginLink: {
    color: '#60A5FA',
    fontWeight: '800',
    fontSize: 14,
  },
  tabsRow: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    gap: 8,
    flexWrap: 'wrap',
    marginBottom: 4,
  },
  tabButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    backgroundColor: 'rgba(30, 41, 59, 0.5)',
  },
  tabButtonActive: {
    borderColor: 'rgba(16, 185, 129, 0.5)',
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
  },
  tabLabel: {
    color: '#94A3B8',
    fontWeight: '700',
    fontSize: 14,
  },
  tabLabelActive: {
    color: '#10B981',
    fontWeight: '800',
  },
  content: {
    padding: 12,
    gap: 10,
    paddingBottom: 32,
  },
  emptyText: {
    color: '#64748B',
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 40,
    fontSize: 15,
  },
  resultItem: {
    gap: 4,
  },
  resultCategory: {
    fontSize: 12,
    fontWeight: '800',
    color: '#94A3B8',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  resultWinner: {
    fontWeight: '900',
    color: '#10B981',
    fontSize: 17,
  },
  resultOpponent: {
    fontWeight: '700',
    color: '#94A3B8',
    fontSize: 15,
  },
  resultScores: {
    color: '#64748B',
    fontSize: 14,
    fontWeight: '700',
    marginTop: 2,
    letterSpacing: 0.5,
  },
  errorText: {
    color: '#EF4444',
    fontWeight: '700',
    textAlign: 'center',
  },
});
