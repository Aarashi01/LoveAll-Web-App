import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { theme } from '@/constants/theme';
import { type MatchDocument, type ScoreGame } from '@/lib/firestore/types';

type WatchMatchCardProps = {
  match: MatchDocument;
  onPress?: () => void;
};

function getActiveGame(match: MatchDocument): ScoreGame | null {
  if (match.scores.length === 0) return null;
  return (
    match.scores.find((s) => s.winner === null) ??
    match.scores[match.scores.length - 1]
  );
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

function formatMatchTime(match: MatchDocument): string {
  if (match.status === 'completed') return 'FT';
  if (match.status === 'live') return 'LIVE';
  if (match.scheduledTime) {
    const date = match.scheduledTime.toDate();
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  return '—';
}

function getSetLabel(match: MatchDocument): string | null {
  if (match.status !== 'live') return null;
  const activeGame = match.scores.find((s) => s.winner === null);
  if (!activeGame) return null;
  return `${activeGame.gameNumber}${activeGame.gameNumber === 1 ? 'st' : activeGame.gameNumber === 2 ? 'nd' : 'rd'} set`;
}

export function WatchMatchCard({ match, onPress }: WatchMatchCardProps) {
  const pulseOpacity = useSharedValue(1);

  React.useEffect(() => {
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

  const animatedDot = useAnimatedStyle(() => ({
    opacity: pulseOpacity.value,
  }));

  const activeGame = useMemo(() => getActiveGame(match), [match]);
  const gamesWon = useMemo(() => getGamesWon(match), [match]);
  const timeLabel = useMemo(() => formatMatchTime(match), [match]);
  const setLabel = useMemo(() => getSetLabel(match), [match]);
  const isLive = match.status === 'live';
  const isCompleted = match.status === 'completed';

  const p1Won = isCompleted && match.winnerId === match.player1Id;
  const p2Won = isCompleted && match.winnerId === match.player2Id;

  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      onPress={onPress}
    >
      <View style={styles.timeColumn}>
        {isLive ? <Animated.View style={[styles.liveDot, animatedDot]} /> : null}
        <Text
          style={[
            styles.timeText,
            isLive && styles.liveTimeText,
            isCompleted && styles.ftText,
          ]}
        >
          {timeLabel}
        </Text>
        {setLabel ? <Text style={styles.setLabel}>{setLabel}</Text> : null}
      </View>

      <View style={styles.playersColumn}>
        <View style={styles.playerRow}>
          <Text
            style={[styles.playerName, p1Won && styles.winnerName, (!p1Won && isCompleted) && styles.loserName]}
            numberOfLines={1}
          >
            {match.player1Name}
            {match.partner1Name ? ` / ${match.partner1Name}` : ''}
          </Text>
        </View>
        <View style={styles.playerRow}>
          <Text
            style={[styles.playerName, p2Won && styles.winnerName, (!p2Won && isCompleted) && styles.loserName]}
            numberOfLines={1}
          >
            {match.player2Name}
            {match.partner2Name ? ` / ${match.partner2Name}` : ''}
          </Text>
        </View>
      </View>

      <View style={styles.scoresColumn}>
        {activeGame ? (
          <>
            <View style={styles.scoreRow}>
              <Text style={[styles.currentScore, p1Won && styles.winnerScore]}>
                {activeGame.p1Score}
              </Text>
              {gamesWon.p1 + gamesWon.p2 > 0 ? (
                <Text style={[styles.gamesWonScore, p1Won && styles.winnerScore]}>
                  {gamesWon.p1}
                </Text>
              ) : null}
            </View>
            <View style={styles.scoreRow}>
              <Text style={[styles.currentScore, p2Won && styles.winnerScore]}>
                {activeGame.p2Score}
              </Text>
              {gamesWon.p1 + gamesWon.p2 > 0 ? (
                <Text style={[styles.gamesWonScore, p2Won && styles.winnerScore]}>
                  {gamesWon.p2}
                </Text>
              ) : null}
            </View>
          </>
        ) : (
          <>
            <Text style={styles.currentScore}>—</Text>
            <Text style={styles.currentScore}>—</Text>
          </>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: theme.spacing.xl,
    gap: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    ...(typeof window !== 'undefined' && ({
      transition: 'background-color 120ms ease',
      cursor: 'pointer',
    } as any)),
  },
  cardPressed: {
    backgroundColor: theme.colors.surfaceSoft,
  },
  timeColumn: {
    width: 56,
    gap: 4,
    alignItems: 'flex-start',
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.live,
  },
  timeText: {
    color: theme.colors.textMuted,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  liveTimeText: {
    color: theme.colors.live,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  ftText: {
    color: theme.colors.textMuted,
  },
  setLabel: {
    color: theme.colors.live,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  playersColumn: {
    flex: 1,
    gap: 4,
  },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  playerName: {
    color: theme.colors.text,
    fontSize: 15,
    fontWeight: '700',
    flex: 1,
  },
  winnerName: {
    color: theme.colors.text,
    fontWeight: '900',
  },
  loserName: {
    color: theme.colors.textMuted,
  },
  scoresColumn: {
    alignItems: 'flex-end',
    gap: 4,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  currentScore: {
    color: theme.colors.text,
    fontSize: 17,
    fontWeight: '900',
    minWidth: 22,
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },
  gamesWonScore: {
    color: theme.colors.textMuted,
    fontSize: 14,
    fontWeight: '800',
    minWidth: 14,
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },
  winnerScore: {
    color: theme.colors.text,
  },
});
