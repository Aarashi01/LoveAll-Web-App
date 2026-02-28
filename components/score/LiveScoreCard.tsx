import { useEffect, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { type MatchDocument, type ScoreGame } from '@/lib/firestore/types';

type LiveScoreCardProps = {
  match: MatchDocument;
  compact?: boolean;
  dark?: boolean;
};

function getActiveGame(match: MatchDocument): ScoreGame {
  return (
    match.scores.find((score) => score.winner === null) ??
    match.scores[match.scores.length - 1] ?? {
      gameNumber: 1,
      p1Score: 0,
      p2Score: 0,
      winner: null,
      startedAt: null,
      endedAt: null,
    }
  );
}

function getCompletedGameScores(match: MatchDocument): string {
  const completed = match.scores.filter((g) => g.winner !== null);
  if (completed.length === 0) return '';
  return completed.map((g) => `${g.p1Score}-${g.p2Score}`).join(' · ');
}

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

export function LiveScoreCard({ match, compact = false, dark = false }: LiveScoreCardProps) {
  const pulseOpacity = useSharedValue(1);

  useEffect(() => {
    if (match.status !== 'live') {
      pulseOpacity.value = 1;
      return;
    }

    pulseOpacity.value = withRepeat(
      withSequence(
        withTiming(0.4, { duration: 700 }),
        withTiming(1, { duration: 700 }),
      ),
      -1,
      true,
    );
  }, [match.status, pulseOpacity]);

  const animatedDotStyle = useAnimatedStyle(() => ({
    opacity: pulseOpacity.value,
  }));

  const activeGame = useMemo(() => getActiveGame(match), [match]);
  const completedScores = useMemo(() => getCompletedGameScores(match), [match]);
  const gamesWon = useMemo(() => getGamesWon(match), [match]);

  const statusDotStyle = [
    styles.dot,
    match.status === 'live' ? styles.dotLive : styles.dotScheduled,
    animatedDotStyle,
  ];

  const isWinner = (playerId: string) => match.status === 'completed' && match.winnerId === playerId;

  return (
    <View style={[styles.card, dark && styles.cardDark, compact && styles.cardCompact]}>
      {/* Header row */}
      <View style={styles.headerRow}>
        <Text style={[styles.meta, dark && styles.metaDark]}>
          {match.category} · {match.round}
          {typeof match.courtNumber === 'number' ? ` · Court ${match.courtNumber}` : ''}
        </Text>
        <View style={styles.headerRight}>
          {gamesWon.p1 + gamesWon.p2 > 0 && (
            <View style={styles.gamesWonBadge}>
              <Text style={styles.gamesWonText}>{gamesWon.p1} - {gamesWon.p2}</Text>
            </View>
          )}
          <Animated.View style={statusDotStyle} />
        </View>
      </View>

      {/* Player 1 row */}
      <View style={[styles.playersRow, isWinner(match.player1Id) && styles.winnerRow]}>
        <View style={styles.nameColumn}>
          <Text
            style={[
              styles.name,
              compact && styles.nameCompact,
              dark && styles.textDark,
              isWinner(match.player1Id) && styles.winnerName,
            ]}
            numberOfLines={1}
          >
            {match.player1Name}
          </Text>
          {match.partner1Name ? (
            <Text style={[styles.partnerName, dark && styles.partnerNameDark]} numberOfLines={1}>
              / {match.partner1Name}
            </Text>
          ) : null}
        </View>
        <Text style={[styles.score, compact && styles.scoreCompact, dark && styles.textDark]}>
          {activeGame.p1Score}
        </Text>
      </View>

      {/* Player 2 row */}
      <View style={[styles.playersRow, isWinner(match.player2Id) && styles.winnerRow]}>
        <View style={styles.nameColumn}>
          <Text
            style={[
              styles.name,
              compact && styles.nameCompact,
              dark && styles.textDark,
              isWinner(match.player2Id) && styles.winnerName,
            ]}
            numberOfLines={1}
          >
            {match.player2Name}
          </Text>
          {match.partner2Name ? (
            <Text style={[styles.partnerName, dark && styles.partnerNameDark]} numberOfLines={1}>
              / {match.partner2Name}
            </Text>
          ) : null}
        </View>
        <Text style={[styles.score, compact && styles.scoreCompact, dark && styles.textDark]}>
          {activeGame.p2Score}
        </Text>
      </View>

      {/* Completed game scores */}
      {completedScores ? (
        <View style={styles.historyRow}>
          <Text style={[styles.historyText, dark && styles.historyTextDark]}>
            {completedScores}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.5)',
    gap: 8,
    ...(typeof window !== 'undefined' && {
      backdropFilter: 'blur(16px)',
      boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.1)',
      transition: 'all 0.3s ease',
    }),
  },
  cardCompact: {
    padding: 14,
    borderRadius: 16,
    gap: 6,
  },
  cardDark: {
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    borderColor: 'rgba(255, 255, 255, 0.1)',
    ...(typeof window !== 'undefined' && {
      boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.4)',
    }),
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  meta: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  metaDark: {
    color: '#94A3B8',
  },
  gamesWonBadge: {
    backgroundColor: 'rgba(59, 130, 246, 0.12)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  gamesWonText: {
    color: '#60A5FA',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 1,
  },
  playersRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    borderRadius: 10,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  winnerRow: {
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  nameColumn: {
    flex: 1,
    gap: 1,
  },
  name: {
    fontSize: 22,
    color: '#0F172A',
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  nameCompact: {
    fontSize: 18,
    fontWeight: '800',
  },
  winnerName: {
    color: '#10B981',
  },
  partnerName: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '600',
  },
  partnerNameDark: {
    color: '#475569',
  },
  score: {
    fontSize: 52,
    lineHeight: 56,
    color: '#0F172A',
    fontWeight: '900',
    minWidth: 56,
    textAlign: 'right',
  },
  scoreCompact: {
    fontSize: 38,
    lineHeight: 42,
    minWidth: 42,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 999,
  },
  dotLive: {
    backgroundColor: '#10B981',
    ...(typeof window !== 'undefined' && {
      boxShadow: '0 0 12px 2px rgba(16, 185, 129, 0.6)',
    }),
  },
  dotScheduled: {
    backgroundColor: '#64748B',
  },
  textDark: {
    color: '#F8FAFC',
  },
  historyRow: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.06)',
    paddingTop: 6,
    marginTop: 2,
  },
  historyText: {
    color: '#64748B',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  historyTextDark: {
    color: '#475569',
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
  },
});
