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

import { MatchScoreGrid } from '@/components/watch/MatchScoreGrid';
import { MatchSetSummary } from '@/components/watch/MatchSetSummary';
import { MatchStatistics } from '@/components/watch/MatchStatistics';
import { theme } from '@/constants/theme';
import { subscribeToMatch } from '@/lib/firestore/matches';
import { type MatchDocument, type ScoreGame } from '@/lib/firestore/types';

type DetailTab = 'details' | 'statistics' | 'matches';

function getGamesWon(match: MatchDocument): { p1: number; p2: number } {
  return match.scores.reduce(
    (acc, g) => {
      if (g.winner === 'p1') acc.p1 += 1;
      if (g.winner === 'p2') acc.p2 += 1;
      return acc;
    },
    { p1: 0, p2: 0 },
  );
}

function getActiveSetLabel(match: MatchDocument): string | null {
  if (match.status !== 'live') return null;
  const activeGame = match.scores.find((s) => s.winner === null);
  if (!activeGame) return null;
  const num = activeGame.gameNumber;
  return `${num}${num === 1 ? 'st' : num === 2 ? 'nd' : 'rd'} set`;
}

function getPlayerInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0][0]?.toUpperCase() ?? '?';
  return `${parts[0][0]}/${parts[parts.length - 1][0]}`.toUpperCase();
}

export default function WatchMatchDetailScreen() {
  const { matchId, tournamentId } = useLocalSearchParams<{ matchId: string; tournamentId?: string }>();
  const [match, setMatch] = useState<MatchDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<DetailTab>('details');

  useEffect(() => {
    if (!tournamentId || !matchId) {
      setLoading(false);
      return;
    }
    const unsubscribe = subscribeToMatch(
      tournamentId,
      matchId,
      (nextMatch) => {
        setMatch(nextMatch);
        setLoading(false);
      },
      () => setLoading(false),
    );
    return unsubscribe;
  }, [tournamentId, matchId]);

  const gamesWon = useMemo(() => (match ? getGamesWon(match) : { p1: 0, p2: 0 }), [match]);
  const setLabel = useMemo(() => (match ? getActiveSetLabel(match) : null), [match]);

  if (loading) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator size="large" color="#10B981" />
      </SafeAreaView>
    );
  }

  if (!match) {
    return (
      <SafeAreaView style={styles.centered}>
        <Text style={styles.errorText}>Match not found.</Text>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>Go Back</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const p1Initials = getPlayerInitials(match.player1Name);
  const p2Initials = getPlayerInitials(match.player2Name);
  const isLive = match.status === 'live';

  const tabs: { key: DetailTab; label: string }[] = [
    { key: 'details', label: 'Details' },
    { key: 'statistics', label: 'Statistics' },
    { key: 'matches', label: 'Matches' },
  ];

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Top header */}
      <View style={styles.topBar}>
        <Pressable style={styles.backArrow} onPress={() => router.back()}>
          <Text style={styles.backArrowText}>←</Text>
        </Pressable>
        <View style={{ flex: 1 }} />
      </View>

      {/* Match header with player avatars and score */}
      <View style={styles.matchHeader}>
        {/* Player 1 */}
        <View style={styles.playerColumn}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{p1Initials}</Text>
          </View>
          <Text style={styles.playerName} numberOfLines={2}>{match.player1Name}</Text>
          {match.partner1Name ? (
            <Text style={styles.partnerName} numberOfLines={1}>{match.partner1Name}</Text>
          ) : null}
        </View>

        {/* Score center */}
        <View style={styles.scoreCenter}>
          <Text style={[styles.gamesWonText, isLive && styles.liveScoreText]}>
            {gamesWon.p1} - {gamesWon.p2}
          </Text>
          {setLabel ? (
            <Text style={styles.setLabelText}>{setLabel}</Text>
          ) : match.status === 'completed' ? (
            <Text style={styles.completedLabel}>Completed</Text>
          ) : null}
        </View>

        {/* Player 2 */}
        <View style={styles.playerColumn}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{p2Initials}</Text>
          </View>
          <Text style={styles.playerName} numberOfLines={2}>{match.player2Name}</Text>
          {match.partner2Name ? (
            <Text style={styles.partnerName} numberOfLines={1}>{match.partner2Name}</Text>
          ) : null}
        </View>
      </View>

      {/* Tab bar */}
      <View style={styles.tabBar}>
        {tabs.map((tab) => (
          <Pressable
            key={tab.key}
            style={[styles.tab, activeTab === tab.key && styles.tabActive]}
            onPress={() => setActiveTab(tab.key)}
          >
            <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>
              {tab.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Tab content */}
      <ScrollView contentContainerStyle={styles.content}>
        {activeTab === 'details' && (
          <View style={styles.detailsContainer}>
            <MatchSetSummary match={match} />
            <MatchScoreGrid scores={match.scores} />
          </View>
        )}

        {activeTab === 'statistics' && (
          <MatchStatistics match={match} />
        )}

        {activeTab === 'matches' && (
          <View style={styles.placeholderContainer}>
            <Text style={styles.placeholderEmoji}>📊</Text>
            <Text style={styles.placeholderText}>
              Head-to-head history will be available in a future update.
            </Text>
          </View>
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
  errorText: {
    color: theme.colors.danger,
    fontWeight: '800',
    fontSize: 16,
  },
  backBtn: {
    marginTop: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: theme.colors.text,
    borderRadius: theme.radius.full,
  },
  backBtnText: {
    color: theme.colors.textInverse,
    fontWeight: '800',
    fontSize: 13,
    letterSpacing: 0.4,
  },

  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
    paddingTop: 12,
    paddingBottom: 8,
    backgroundColor: theme.colors.surfaceInverse,
  },
  backArrow: {
    width: 36,
    height: 36,
    borderRadius: theme.radius.full,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    ...(typeof window !== 'undefined' && ({ cursor: 'pointer' } as any)),
  },
  backArrowText: {
    color: theme.colors.textInverse,
    fontSize: 16,
    fontWeight: '800',
  },

  matchHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.xl,
    paddingTop: 12,
    paddingBottom: theme.spacing.xl,
    backgroundColor: theme.colors.surfaceInverse,
    gap: theme.spacing.md,
  },
  playerColumn: {
    alignItems: 'center',
    width: 110,
    gap: 8,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.textInverse,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: theme.colors.text,
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  playerName: {
    color: theme.colors.textInverse,
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'center',
    lineHeight: 18,
    letterSpacing: -0.2,
  },
  partnerName: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },
  scoreCenter: {
    alignItems: 'center',
    gap: 2,
  },
  gamesWonText: {
    color: theme.colors.textInverse,
    fontSize: 56,
    fontWeight: '900',
    letterSpacing: -2,
    fontVariant: ['tabular-nums'],
    lineHeight: 56,
  },
  liveScoreText: {
    color: theme.colors.live,
  },
  setLabelText: {
    color: theme.colors.live,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  completedLabel: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },

  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: theme.colors.text,
  },
  tabText: {
    color: theme.colors.textMuted,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  tabTextActive: {
    color: theme.colors.text,
    fontWeight: '900',
  },

  content: {
    padding: theme.spacing.lg,
    paddingBottom: 48,
  },
  detailsContainer: {
    gap: 10,
  },
  placeholderContainer: {
    alignItems: 'flex-start',
    paddingTop: 48,
    gap: 8,
  },
  placeholderEmoji: {
    fontSize: 40,
  },
  placeholderText: {
    color: theme.colors.textMuted,
    fontSize: 14,
    fontWeight: '500',
    maxWidth: 320,
  },
});
