import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { type MatchDocument } from '@/lib/firestore/types';

type LiveScoreCardProps = {
  match: MatchDocument;
  compact?: boolean;
  dark?: boolean;
};

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
        withTiming(1, { duration: 700 })
      ),
      -1,
      true
    );
  }, [match.status, pulseOpacity]);

  const animatedDotStyle = useAnimatedStyle(() => ({
    opacity: pulseOpacity.value,
  }));

  const activeGame =
    match.scores.find((score) => score.winner === null) ??
    match.scores[match.scores.length - 1] ?? {
      p1Score: 0,
      p2Score: 0,
    };

  const statusDotStyle = [
    styles.dot,
    match.status === 'live' ? styles.dotLive : styles.dotScheduled,
    animatedDotStyle,
  ];

  return (
    <View style={[styles.card, dark && styles.cardDark, compact && styles.cardCompact]}>
      <View style={styles.headerRow}>
        <Text style={[styles.meta, dark && styles.textDark]}>
          {match.category} - {match.round}
          {typeof match.courtNumber === 'number' ? ` - Court ${match.courtNumber}` : ''}
        </Text>
        <Animated.View style={statusDotStyle} />
      </View>

      <View style={styles.playersRow}>
        <Text style={[styles.name, compact && styles.nameCompact, dark && styles.textDark]}>
          {match.player1Name}
        </Text>
        <Text style={[styles.score, compact && styles.scoreCompact, dark && styles.textDark]}>
          {activeGame.p1Score}
        </Text>
      </View>

      <View style={styles.playersRow}>
        <Text style={[styles.name, compact && styles.nameCompact, dark && styles.textDark]}>
          {match.player2Name}
        </Text>
        <Text style={[styles.score, compact && styles.scoreCompact, dark && styles.textDark]}>
          {activeGame.p2Score}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.5)',
    gap: 12,
    ...(typeof window !== 'undefined' && {
      backdropFilter: 'blur(16px)',
      boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.1)',
      transition: 'all 0.3s ease',
    }),
  },
  cardCompact: {
    padding: 16,
    borderRadius: 16,
    gap: 8,
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
  meta: {
    fontSize: 15,
    color: '#64748B',
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  playersRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  name: {
    flex: 1,
    fontSize: 26,
    color: '#0F172A',
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  nameCompact: {
    fontSize: 20,
    fontWeight: '800',
  },
  score: {
    fontSize: 76,
    lineHeight: 82,
    color: '#0F172A',
    fontWeight: '900',
    minWidth: 80,
    textAlign: 'right',
  },
  scoreCompact: {
    fontSize: 48,
    lineHeight: 54,
    minWidth: 54,
  },
  dot: {
    width: 12,
    height: 12,
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
});
