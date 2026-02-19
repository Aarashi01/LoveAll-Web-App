import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';

import { LiveScoreCard } from '@/components/score/LiveScoreCard';
import { useMatches } from '@/hooks/useMatches';
import { subscribeToPublicTournamentBySlug } from '@/lib/firestore/tournaments';
import { type TournamentDocument } from '@/lib/firestore/types';

const PAGE_SIZE = 4;
const ROTATE_MS = 15000;

export default function TvDisplayScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const [tournament, setTournament] = useState<TournamentDocument | null>(null);
  const [loadingTournament, setLoadingTournament] = useState(true);
  const [clock, setClock] = useState(new Date());
  const [pageIndex, setPageIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

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

  const activeMatches = useMemo(
    () => matches.filter((match) => match.status === 'live' || match.status === 'scheduled'),
    [matches],
  );

  const pageCount = Math.max(1, Math.ceil(activeMatches.length / PAGE_SIZE));
  const selectedMatches = useMemo(
    () => activeMatches.slice(pageIndex * PAGE_SIZE, pageIndex * PAGE_SIZE + PAGE_SIZE),
    [activeMatches, pageIndex],
  );

  useEffect(() => {
    if (pageCount <= 1) return;

    const timer = setInterval(() => {
      setPageIndex((prev) => (prev + 1) % pageCount);
    }, ROTATE_MS);

    return () => clearInterval(timer);
  }, [pageCount]);

  useEffect(() => {
    if (pageIndex > pageCount - 1) setPageIndex(0);
  }, [pageCount, pageIndex]);

  if (loadingTournament || loadingMatches) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator size="large" color="#39D353" />
      </SafeAreaView>
    );
  }

  if (!tournament) {
    return (
      <SafeAreaView style={styles.centered}>
        <Text style={styles.emptyText}>Tournament not found or public view disabled.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Text style={styles.tournamentName}>{tournament.name}</Text>
        <Text style={styles.clock}>{clock.toLocaleTimeString()}</Text>
      </View>

      <View style={styles.tabsRow}>
        {Array.from({ length: pageCount }).map((_, index) => (
          <Pressable
            key={index}
            style={[styles.tab, pageIndex === index && styles.tabActive]}
            onPress={() => setPageIndex(index)}
          >
            <Text style={[styles.tabText, pageIndex === index && styles.tabTextActive]}>
              Courts {index * PAGE_SIZE + 1}-{Math.min((index + 1) * PAGE_SIZE, activeMatches.length)}
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.grid}>
        {selectedMatches.length === 0 ? (
          <Text style={styles.emptyText}>No live/scheduled matches right now.</Text>
        ) : (
          selectedMatches.map((match) => <LiveScoreCard key={match.id} match={match} dark />)
        )}
      </View>

      <Text style={styles.footerBrand}>LoveAll Live Board</Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0A0A0A',
    padding: 16,
    gap: 14,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0A0A0A',
    padding: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  tournamentName: {
    color: '#F8FAFC',
    fontSize: 28,
    fontWeight: '900',
    flex: 1,
  },
  clock: {
    color: '#94A3B8',
    fontSize: 22,
    fontWeight: '700',
  },
  tabsRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  tab: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#334155',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  tabActive: {
    backgroundColor: '#0F5132',
    borderColor: '#39D353',
  },
  tabText: {
    color: '#94A3B8',
    fontWeight: '700',
  },
  tabTextActive: {
    color: '#DCFCE7',
  },
  grid: {
    flex: 1,
    gap: 12,
  },
  emptyText: {
    color: '#CBD5E1',
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 40,
  },
  footerBrand: {
    color: '#475569',
    textAlign: 'center',
    fontWeight: '700',
    letterSpacing: 1,
  },
});
