import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Link, useLocalSearchParams } from 'expo-router';

import { LiveScoreCard } from '@/components/score/LiveScoreCard';
import { useMatches } from '@/hooks/useMatches';
import { calculateStandings } from '@/lib/schedule-generator';
import { subscribeToPublicTournamentBySlug } from '@/lib/firestore/tournaments';
import { type MatchDocument, type TournamentDocument } from '@/lib/firestore/types';

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

      <View style={styles.banner}>
        <Text style={styles.bannerText}>Viewing as spectator. Log in to manage.</Text>
        <Link href="/(auth)/login" style={styles.bannerLink}>
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
                <View key={`${group.category}-${group.groupId}`} style={styles.groupCard}>
                  <Text style={styles.groupTitle}>
                    {group.category} - {group.groupId}
                  </Text>
                  <View style={styles.tableHeader}>
                    <Text style={[styles.tableCell, styles.rankCol]}>#</Text>
                    <Text style={[styles.tableCell, styles.nameCol]}>Name</Text>
                    <Text style={styles.tableCell}>P</Text>
                    <Text style={styles.tableCell}>W</Text>
                    <Text style={styles.tableCell}>L</Text>
                    <Text style={styles.tableCell}>Pts</Text>
                  </View>
                  {standings.map((row, index) => (
                    <View key={row.id} style={styles.tableRow}>
                      <Text style={[styles.tableCell, styles.rankCol]}>{index + 1}</Text>
                      <Text style={[styles.tableCell, styles.nameCol]}>{row.name}</Text>
                      <Text style={styles.tableCell}>{row.played}</Text>
                      <Text style={styles.tableCell}>{row.wins}</Text>
                      <Text style={styles.tableCell}>{row.losses}</Text>
                      <Text style={styles.tableCell}>{row.points}</Text>
                    </View>
                  ))}
                </View>
              );
            })
          ))}

        {tab === 'bracket' &&
          (knockoutMatches.length === 0 ? (
            <Text style={styles.emptyText}>Knockout bracket is not generated yet.</Text>
          ) : (
            knockoutMatches.map((match) => (
              <View key={match.id} style={styles.bracketItem}>
                <Text style={styles.bracketRound}>
                  {match.round} - {match.category}
                </Text>
                <Text style={styles.bracketPairing}>
                  {match.player1Name} vs {match.player2Name}
                </Text>
                <Text style={styles.bracketMeta}>Status: {match.status}</Text>
              </View>
            ))
          ))}

        {tab === 'results' &&
          (matches.filter((match) => match.status === 'completed').length === 0 ? (
            <Text style={styles.emptyText}>No completed results yet.</Text>
          ) : (
            matches
              .filter((match) => match.status === 'completed')
              .map((match) => (
                <View key={match.id} style={styles.resultItem}>
                  <Text style={styles.resultTitle}>
                    {match.category} {match.round}
                  </Text>
                  <Text style={styles.resultBody}>
                    Winner:{' '}
                    {match.winnerId === match.player1Id ? match.player1Name : match.player2Name}
                  </Text>
                </View>
              ))
          ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8FAFC',
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
    color: '#0F172A',
  },
  banner: {
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 10,
    padding: 10,
    backgroundColor: '#E2E8F0',
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
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
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
    color: '#64748B',
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 28,
  },
  groupCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
    padding: 10,
    gap: 6,
  },
  groupTitle: {
    fontWeight: '900',
    fontSize: 16,
    color: '#0F172A',
  },
  tableHeader: {
    flexDirection: 'row',
    paddingVertical: 6,
    borderTopWidth: 1,
    borderColor: '#E2E8F0',
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 4,
    borderTopWidth: 1,
    borderColor: '#F1F5F9',
  },
  tableCell: {
    width: 30,
    textAlign: 'center',
    color: '#334155',
    fontWeight: '600',
  },
  rankCol: {
    width: 24,
  },
  nameCol: {
    flex: 1,
    textAlign: 'left',
    paddingLeft: 8,
  },
  bracketItem: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#DCFCE7',
    backgroundColor: '#FFFFFF',
    padding: 12,
    gap: 4,
  },
  bracketRound: {
    color: '#166534',
    fontWeight: '900',
  },
  bracketPairing: {
    color: '#0F172A',
    fontWeight: '700',
  },
  bracketMeta: {
    color: '#475569',
    fontWeight: '600',
  },
  resultItem: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    backgroundColor: '#FFFFFF',
    padding: 10,
    gap: 2,
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
