import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { theme } from '@/constants/theme';
import { type MatchDocument, type ScoreGame } from '@/lib/firestore/types';

type MatchStatisticsProps = {
  match: MatchDocument;
};

type GameFilter = 'all' | number; // number = gameNumber

// ─── Stat Computation Helpers ─────────────────────────────────────────

function computeTotalPoints(games: ScoreGame[]): { p1: number; p2: number } {
  return games.reduce(
    (acc, g) => ({
      p1: acc.p1 + g.p1Score,
      p2: acc.p2 + g.p2Score,
    }),
    { p1: 0, p2: 0 },
  );
}

function computeMaxStreak(games: ScoreGame[]): { p1: number; p2: number } {
  let maxP1 = 0;
  let maxP2 = 0;

  for (const game of games) {
    const history = game.pointHistory ?? [];
    if (history.length === 0) continue;

    let streakP1 = 0;
    let streakP2 = 0;

    for (let i = 0; i < history.length; i++) {
      const prevP1 = i > 0 ? history[i - 1][0] : 0;
      const prevP2 = i > 0 ? history[i - 1][1] : 0;
      const [p1, p2] = history[i];

      if (p1 > prevP1) {
        streakP1++;
        streakP2 = 0;
      } else if (p2 > prevP2) {
        streakP2++;
        streakP1 = 0;
      }

      maxP1 = Math.max(maxP1, streakP1);
      maxP2 = Math.max(maxP2, streakP2);
    }
  }

  return { p1: maxP1, p2: maxP2 };
}

function computeBiggestLead(games: ScoreGame[]): { p1: number; p2: number } {
  let maxLeadP1 = 0;
  let maxLeadP2 = 0;

  for (const game of games) {
    const history = game.pointHistory ?? [];
    for (const [p1, p2] of history) {
      if (p1 > p2) maxLeadP1 = Math.max(maxLeadP1, p1 - p2);
      if (p2 > p1) maxLeadP2 = Math.max(maxLeadP2, p2 - p1);
    }
  }

  return { p1: maxLeadP1, p2: maxLeadP2 };
}

function computeMatchPoints(games: ScoreGame[], pointsPerGame: number): { p1: number; p2: number } {
  let count = { p1: 0, p2: 0 };

  for (const game of games) {
    const history = game.pointHistory ?? [];
    for (const [p1, p2] of history) {
      if (p1 >= pointsPerGame - 1 && p1 > p2) count.p1++;
      if (p2 >= pointsPerGame - 1 && p2 > p1) count.p2++;
    }
  }

  return count;
}

function computeComebackToWin(games: ScoreGame[]): { p1: number; p2: number } {
  let count = { p1: 0, p2: 0 };
  const TRAILING_THRESHOLD = 5;

  for (const game of games) {
    if (!game.winner) continue;
    const history = game.pointHistory ?? [];
    let maxTrailingP1 = 0; // max deficit for p1
    let maxTrailingP2 = 0;

    for (const [p1, p2] of history) {
      if (p2 - p1 > maxTrailingP1) maxTrailingP1 = p2 - p1;
      if (p1 - p2 > maxTrailingP2) maxTrailingP2 = p1 - p2;
    }

    if (game.winner === 'p1' && maxTrailingP1 >= TRAILING_THRESHOLD) count.p1++;
    if (game.winner === 'p2' && maxTrailingP2 >= TRAILING_THRESHOLD) count.p2++;
  }

  return count;
}

// ─── Stat Bar Component ─────────────────────────────────────────────

function StatBar({ label, p1Value, p2Value }: { label: string; p1Value: number; p2Value: number }) {
  const total = p1Value + p2Value || 1;
  const p1Pct = (p1Value / total) * 100;
  const p2Pct = (p2Value / total) * 100;
  const p1Leads = p1Value > p2Value;
  const p2Leads = p2Value > p1Value;

  return (
    <View style={statStyles.container}>
      {/* Values row */}
      <View style={statStyles.valuesRow}>
        <Text style={[statStyles.value, p1Leads && statStyles.leadingValue]}>{p1Value}</Text>
        <Text style={statStyles.label}>{label}</Text>
        <Text style={[statStyles.value, p2Leads && statStyles.leadingValue]}>{p2Value}</Text>
      </View>
      {/* Bar row */}
      <View style={statStyles.barRow}>
        <View style={statStyles.barTrack}>
          <View
            style={[
              statStyles.barFillLeft,
              { width: `${p1Pct}%` },
              p1Leads ? statStyles.barFillLeading : statStyles.barFillTrailing,
            ]}
          />
        </View>
        <View style={statStyles.barTrack}>
          <View
            style={[
              statStyles.barFillRight,
              { width: `${p2Pct}%` },
              p2Leads ? statStyles.barFillLeading : statStyles.barFillTrailing,
            ]}
          />
        </View>
      </View>
    </View>
  );
}

// ─── Main Component ─────────────────────────────────────────────────

export function MatchStatistics({ match }: MatchStatisticsProps) {
  const [gameFilter, setGameFilter] = useState<GameFilter>('all');

  const filteredGames = useMemo(() => {
    if (gameFilter === 'all') return match.scores;
    return match.scores.filter((g) => g.gameNumber === gameFilter);
  }, [match.scores, gameFilter]);

  const hasHistory = match.scores.some((g) => g.pointHistory && g.pointHistory.length > 0);

  const stats = useMemo(() => {
    if (!hasHistory) return null;
    return {
      totalPoints: computeTotalPoints(filteredGames),
      maxStreak: computeMaxStreak(filteredGames),
      biggestLead: computeBiggestLead(filteredGames),
      matchPoints: computeMatchPoints(filteredGames, 21), // Default badminton
      comebackToWin: computeComebackToWin(filteredGames),
    };
  }, [filteredGames, hasHistory]);

  const filterTabs = useMemo(() => {
    const tabs: { key: GameFilter; label: string }[] = [{ key: 'all', label: 'ALL' }];
    match.scores.forEach((g) => {
      const num = g.gameNumber;
      const label = num === 1 ? '1ST' : num === 2 ? '2ND' : '3RD';
      tabs.push({ key: num, label });
    });
    return tabs;
  }, [match.scores]);

  if (!hasHistory) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>
          Statistics are not available for this match.{'\n'}Point-by-point data was not recorded.
        </Text>
      </View>
    );
  }

  if (!stats) return null;

  return (
    <View style={styles.container}>
      {/* Game filter tabs */}
      <View style={styles.tabRow}>
        {filterTabs.map((tab) => (
          <Pressable
            key={String(tab.key)}
            style={[styles.tab, gameFilter === tab.key && styles.tabActive]}
            onPress={() => setGameFilter(tab.key)}
          >
            <Text style={[styles.tabText, gameFilter === tab.key && styles.tabTextActive]}>
              {tab.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Stat bars */}
      <View style={styles.statsContainer}>
        <StatBar label="Points won" p1Value={stats.totalPoints.p1} p2Value={stats.totalPoints.p2} />
        <StatBar label="Max points in a row" p1Value={stats.maxStreak.p1} p2Value={stats.maxStreak.p2} />
        <StatBar label="Match points" p1Value={stats.matchPoints.p1} p2Value={stats.matchPoints.p2} />
        <StatBar label="Comeback to win" p1Value={stats.comebackToWin.p1} p2Value={stats.comebackToWin.p2} />
        <StatBar label="Biggest lead" p1Value={stats.biggestLead.p1} p2Value={stats.biggestLead.p2} />
      </View>
    </View>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { gap: 12 },
  emptyContainer: {
    paddingVertical: 32,
    alignItems: 'flex-start',
  },
  emptyText: {
    color: theme.colors.textMuted,
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 22,
  },
  tabRow: {
    flexDirection: 'row',
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRightWidth: 1,
    borderRightColor: theme.colors.border,
  },
  tabActive: {
    backgroundColor: theme.colors.text,
  },
  tabText: {
    color: theme.colors.text,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
  },
  tabTextActive: {
    color: theme.colors.textInverse,
    fontWeight: '900',
  },
  statsContainer: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.lg,
    gap: theme.spacing.lg,
  },
});

const statStyles = StyleSheet.create({
  container: { gap: 6 },
  valuesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  value: {
    color: theme.colors.textMuted,
    fontSize: 18,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
    minWidth: 28,
  },
  leadingValue: {
    color: theme.colors.text,
    fontWeight: '900',
  },
  label: {
    color: theme.colors.textMuted,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    textAlign: 'center',
    flex: 1,
  },
  barRow: {
    flexDirection: 'row',
    gap: 4,
  },
  barTrack: {
    flex: 1,
    height: 4,
    backgroundColor: theme.colors.border,
    overflow: 'hidden',
  },
  barFillLeft: {
    height: '100%',
    alignSelf: 'flex-end',
  },
  barFillRight: {
    height: '100%',
  },
  barFillLeading: {
    backgroundColor: theme.colors.text,
  },
  barFillTrailing: {
    backgroundColor: theme.colors.textMuted,
  },
});
