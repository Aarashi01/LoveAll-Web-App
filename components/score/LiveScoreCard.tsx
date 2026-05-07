import { useEffect, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { theme } from '@/constants/theme';
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
  return completed.map((g) => `${g.p1Score}–${g.p2Score}`).join(' · ');
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
      <View style={styles.headerRow}>
        <Text style={[styles.meta, dark && styles.metaDark]}>
          {match.category} · {match.round}
          {typeof match.courtNumber === 'number' ? ` · COURT ${match.courtNumber}` : ''}
        </Text>
        <View style={styles.headerRight}>
          {gamesWon.p1 + gamesWon.p2 > 0 && (
            <Text style={[styles.gamesWonText, dark && styles.gamesWonTextDark]}>
              {gamesWon.p1}–{gamesWon.p2}
            </Text>
          )}
          {match.status === 'live' ? (
            <Animated.View style={statusDotStyle} />
          ) : (
            <View style={styles.dotScheduled} />
          )}
        </View>
      </View>

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
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.lg,
    gap: 10,
  },
  cardCompact: {
    padding: theme.spacing.md,
    gap: 8,
  },
  cardDark: {
    backgroundColor: theme.colors.surfaceInverse,
    borderColor: theme.colors.surfaceInverse,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  meta: {
    fontSize: 11,
    color: theme.colors.textMuted,
    fontWeight: '800',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  metaDark: {
    color: 'rgba(255,255,255,0.6)',
  },
  gamesWonText: {
    color: theme.colors.text,
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 1,
    fontVariant: ['tabular-nums'],
  },
  gamesWonTextDark: {
    color: theme.colors.textInverse,
  },
  playersRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  winnerRow: {
    // emphasize winner with left rule
    borderLeftWidth: 3,
    borderLeftColor: theme.colors.text,
    paddingLeft: 8,
    marginLeft: -11,
  },
  nameColumn: {
    flex: 1,
    gap: 1,
  },
  name: {
    fontSize: 22,
    color: theme.colors.text,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  nameCompact: {
    fontSize: 18,
    fontWeight: '800',
  },
  winnerName: {
    color: theme.colors.text,
    fontWeight: '900',
  },
  partnerName: {
    fontSize: 13,
    color: theme.colors.textMuted,
    fontWeight: '600',
  },
  partnerNameDark: {
    color: 'rgba(255,255,255,0.5)',
  },
  score: {
    fontSize: 56,
    lineHeight: 56,
    color: theme.colors.text,
    fontWeight: '900',
    minWidth: 56,
    textAlign: 'right',
    letterSpacing: -2,
    fontVariant: ['tabular-nums'],
  },
  scoreCompact: {
    fontSize: 40,
    lineHeight: 42,
    minWidth: 42,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: theme.radius.full,
  },
  dotLive: {
    backgroundColor: theme.colors.live,
  },
  dotScheduled: {
    backgroundColor: theme.colors.textMuted,
    width: 8,
    height: 8,
    borderRadius: theme.radius.full,
  },
  textDark: {
    color: theme.colors.textInverse,
  },
  historyRow: {
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    paddingTop: 8,
    marginTop: 2,
  },
  historyText: {
    color: theme.colors.textMuted,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.4,
    fontVariant: ['tabular-nums'],
  },
  historyTextDark: {
    color: 'rgba(255,255,255,0.6)',
  },
});
