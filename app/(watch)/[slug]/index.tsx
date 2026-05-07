import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { WatchMatchCard } from '@/components/watch/WatchMatchCard';
import { theme } from '@/constants/theme';
import { useMatches } from '@/hooks/useMatches';
import { subscribeToPublicTournamentBySlug, subscribeToTournamentById } from '@/lib/firestore/tournaments';
import { type MatchCategory, type MatchDocument, type TournamentDocument } from '@/lib/firestore/types';

type FilterTab = 'all' | 'live' | 'completed';

export default function WatchMatchListScreen() {
  const { slug, mode } = useLocalSearchParams<{ slug: string; mode?: string }>();
  const isIdMode = mode === 'id';
  const [tournament, setTournament] = useState<TournamentDocument | null>(null);
  const [loadingTournament, setLoadingTournament] = useState(true);
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all');

  useEffect(() => {
    if (!slug) {
      setLoadingTournament(false);
      return;
    }
    const unsubscribe = isIdMode
      ? subscribeToTournamentById(slug, (doc) => {
          setTournament(doc);
          setLoadingTournament(false);
        })
      : subscribeToPublicTournamentBySlug(slug, (doc) => {
          setTournament(doc);
          setLoadingTournament(false);
        });
    return unsubscribe;
  }, [slug, isIdMode]);

  const { matches, loading: loadingMatches } = useMatches(tournament?.id);

  const filteredMatches = useMemo(() => {
    if (activeFilter === 'live') return matches.filter((m) => m.status === 'live');
    if (activeFilter === 'completed') return matches.filter((m) => m.status === 'completed');
    return matches;
  }, [matches, activeFilter]);

  const groupedByCategory = useMemo(() => {
    const groups = new Map<MatchCategory, MatchDocument[]>();
    filteredMatches.forEach((match) => {
      if (!groups.has(match.category)) groups.set(match.category, []);
      groups.get(match.category)!.push(match);
    });
    return Array.from(groups.entries());
  }, [filteredMatches]);

  const liveCount = useMemo(() => matches.filter((m) => m.status === 'live').length, [matches]);

  if (loadingTournament || loadingMatches) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator size="large" color={theme.colors.text} />
        <Text style={styles.loadingText}>Loading tournament…</Text>
      </SafeAreaView>
    );
  }

  if (!tournament) {
    return (
      <SafeAreaView style={styles.centered}>
        <Text style={styles.errorEyebrow}>Not found</Text>
        <Text style={styles.errorTitle}>Tournament not available.</Text>
        <Text style={styles.errorSubtitle}>
          This tournament doesn't exist or public view is disabled.
        </Text>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Go back</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const handleMatchPress = (match: MatchDocument) => {
    router.push(`/(watch)/${slug}/match/${match.id}?tournamentId=${tournament.id}` as any);
  };

  const filters: { key: FilterTab; label: string; count?: number }[] = [
    { key: 'all', label: 'All' },
    { key: 'live', label: 'Live', count: liveCount },
    { key: 'completed', label: 'Completed' },
  ];

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Hero band */}
      <View style={styles.hero}>
        <Pressable style={styles.backArrow} onPress={() => router.back()} hitSlop={8}>
          <Text style={styles.backArrowText}>←</Text>
        </Pressable>
        <Text style={styles.heroEyebrow}>Watch · Live</Text>
        <Text style={styles.heroTitle} numberOfLines={2}>{tournament.name}</Text>
        <Text style={styles.heroMeta}>
          {matches.length} match{matches.length !== 1 ? 'es' : ''}
          {liveCount > 0 ? ` · ${liveCount} live now` : ''}
        </Text>
      </View>

      {/* Filters */}
      <View style={styles.filterRow}>
        {filters.map((f) => (
          <Pressable
            key={f.key}
            style={[styles.filterTab, activeFilter === f.key && styles.filterTabActive]}
            onPress={() => setActiveFilter(f.key)}
          >
            <Text style={[styles.filterLabel, activeFilter === f.key && styles.filterLabelActive]}>
              {f.label}
            </Text>
            {f.key === 'live' && liveCount > 0 ? (
              <View style={styles.liveBadge}>
                <Text style={styles.liveBadgeText}>{liveCount}</Text>
              </View>
            ) : null}
          </Pressable>
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {groupedByCategory.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>
              {activeFilter === 'live' ? 'No live matches right now.' : 'No matches found.'}
            </Text>
            <Text style={styles.emptyText}>
              Check back when matches are scheduled or going live.
            </Text>
          </View>
        ) : (
          groupedByCategory.map(([category, categoryMatches]) => (
            <View key={category} style={styles.categoryGroup}>
              <View style={styles.categoryHeader}>
                <Text style={styles.categoryLabel}>{category}</Text>
                <View style={styles.categoryRule} />
                <Text style={styles.categoryCount}>{categoryMatches.length}</Text>
              </View>
              <View>
                {categoryMatches.map((match) => (
                  <WatchMatchCard
                    key={match.id}
                    match={match}
                    onPress={() => handleMatchPress(match)}
                  />
                ))}
              </View>
            </View>
          ))
        )}
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
    backgroundColor: theme.colors.background,
    padding: theme.spacing.xl,
    gap: 12,
  },
  loadingText: {
    color: theme.colors.textMuted,
    fontSize: 14,
    fontWeight: '600',
    marginTop: 8,
  },
  errorEyebrow: {
    color: theme.colors.accent,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
  errorTitle: {
    color: theme.colors.text,
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -0.6,
    textAlign: 'center',
  },
  errorSubtitle: {
    color: theme.colors.textMuted,
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
    maxWidth: 320,
  },
  backButton: {
    marginTop: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: theme.colors.text,
    borderRadius: theme.radius.full,
  },
  backButtonText: {
    color: theme.colors.textInverse,
    fontWeight: '800',
    fontSize: 13,
    letterSpacing: 0.6,
  },

  hero: {
    backgroundColor: theme.colors.surfaceInverse,
    paddingHorizontal: theme.spacing.xl,
    paddingTop: theme.spacing.lg,
    paddingBottom: theme.spacing.xl,
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
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: -0.8,
    lineHeight: 36,
  },
  heroMeta: {
    color: theme.colors.textInverse,
    opacity: 0.7,
    fontSize: 13,
    fontWeight: '600',
  },

  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing.md,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  filterTab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: theme.radius.full,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
  },
  filterTabActive: {
    borderColor: theme.colors.text,
    backgroundColor: theme.colors.text,
  },
  filterLabel: {
    color: theme.colors.text,
    fontWeight: '800',
    fontSize: 13,
    letterSpacing: 0.4,
  },
  filterLabelActive: {
    color: theme.colors.textInverse,
  },
  liveBadge: {
    backgroundColor: theme.colors.live,
    borderRadius: theme.radius.full,
    paddingHorizontal: 7,
    paddingVertical: 1,
    minWidth: 20,
    alignItems: 'center',
  },
  liveBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900',
  },

  content: {
    paddingBottom: 64,
  },
  categoryGroup: {
    marginTop: theme.spacing.lg,
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: 8,
    gap: 12,
  },
  categoryLabel: {
    color: theme.colors.text,
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 1.4,
  },
  categoryRule: {
    flex: 1,
    height: 1,
    backgroundColor: theme.colors.text,
  },
  categoryCount: {
    color: theme.colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },

  emptyState: {
    alignItems: 'flex-start',
    paddingHorizontal: theme.spacing.xl,
    paddingTop: 64,
    gap: 8,
  },
  emptyTitle: {
    color: theme.colors.text,
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  emptyText: {
    color: theme.colors.textMuted,
    fontSize: 14,
    fontWeight: '500',
  },
});
