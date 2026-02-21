import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Link, useLocalSearchParams } from 'expo-router';

import { GroupStandingsTable } from '@/components/bracket/GroupStandingsTable';
import { KnockoutBracket } from '@/components/bracket/KnockoutBracket';
import { AppCard } from '@/components/ui/AppCard';
import { theme, toCategoryLabel, toRoundLabel } from '@/constants/theme';
import { LiveScoreCard } from '@/components/score/LiveScoreCard';
import { useMatches } from '@/hooks/useMatches';
import { calculateStandings } from '@/lib/schedule-generator';
import { subscribeToPublicTournamentBySlug } from '@/lib/firestore/tournaments';
import { type MatchCategory, type MatchDocument, type TournamentDocument } from '@/lib/firestore/types';

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
        <ActivityIndicator size="large" />
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
      </View>

      <AppCard style={styles.banner}>
        <Text style={styles.bannerText}>Viewing as spectator. Log in to manage.</Text>
        <Link href="/(auth)/login" style={styles.bannerLink}>
          Login
        </Link>
      </AppCard>

      <View style={styles.tabsRow}>
        {visibleTabs.map((item) => (
          <Pressable
            key={item}
            style={[styles.tabButton, tab === item && styles.tabButtonActive]}
            onPress={() => setTab(item)}
          >
            <Text style={[styles.tabLabel, tab === item && styles.tabLabelActive]}>
              {item === 'live' ? 'Live Matches' : item[0].toUpperCase() + item.slice(1)}
            </Text>
          </Pressable>
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {tab === 'live' &&
          (liveMatches.length === 0 ? (
            <Text style={styles.emptyText}>No live matches right now.</Text>
          ) : (
            liveMatches.map((match) => <LiveScoreCard key={match.id} match={match} compact />)
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
              .map((match) => (
                <AppCard key={match.id} style={styles.resultItem}>
                  <Text style={styles.resultTitle}>
                    {toCategoryLabel(match.category)} {toRoundLabel(match.round)}
                  </Text>
                  <Text style={styles.resultBody}>
                    Winner:{' '}
                    {match.winnerId === match.player1Id ? match.player1Name : match.player2Name}
                  </Text>
                </AppCard>
              ))
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
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 6,
  },
  title: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '900',
    color: theme.colors.text,
  },
  banner: {
    marginHorizontal: 16,
    marginBottom: 8,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  bannerText: {
    flex: 1,
    color: '#334155',
    fontWeight: '600',
  },
  bannerLink: {
    color: '#0F766E',
    fontWeight: '800',
  },
  tabsRow: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    gap: 8,
    flexWrap: 'wrap',
  },
  tabButton: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  tabButtonActive: {
    borderColor: '#166534',
    backgroundColor: '#DCFCE7',
  },
  tabLabel: {
    color: '#334155',
    fontWeight: '700',
  },
  tabLabelActive: {
    color: '#166534',
  },
  content: {
    padding: 12,
    gap: 10,
    paddingBottom: 24,
  },
  emptyText: {
    color: theme.colors.textMuted,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 28,
  },
  resultItem: {
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  resultTitle: {
    fontWeight: '900',
    color: '#1E3A8A',
  },
  resultBody: {
    fontWeight: '700',
    color: '#334155',
  },
  errorText: {
    color: '#B91C1C',
    fontWeight: '700',
    textAlign: 'center',
  },
});
