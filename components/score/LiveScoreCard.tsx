import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';

import { type MatchDocument } from '@/lib/firestore/types';

type LiveScoreCardProps = {
  match: MatchDocument;
  compact?: boolean;
  dark?: boolean;
};

export function LiveScoreCard({ match, compact = false, dark = false }: LiveScoreCardProps) {
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (match.status !== 'live') {
      pulse.setValue(1);
      return;
    }

    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.4, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [match.status, pulse]);

  const activeGame =
    match.scores.find((score) => score.winner === null) ??
    match.scores[match.scores.length - 1] ?? {
      p1Score: 0,
      p2Score: 0,
    };

  const statusDotStyle =
    match.status === 'live' ? [styles.dot, styles.dotLive] : [styles.dot, styles.dotScheduled];

  return (
    <View style={[styles.card, dark && styles.cardDark, compact && styles.cardCompact]}>
      <View style={styles.headerRow}>
        <Text style={[styles.meta, dark && styles.textDark]}>
          {match.category} - {match.round}
          {typeof match.courtNumber === 'number' ? ` - Court ${match.courtNumber}` : ''}
        </Text>
        <Animated.View style={[statusDotStyle, match.status === 'live' ? { opacity: pulse } : null]} />
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
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E7ECEF',
    gap: 8,
  },
  cardCompact: {
    padding: 12,
  },
  cardDark: {
    backgroundColor: '#121212',
    borderColor: '#222222',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  meta: {
    fontSize: 14,
    color: '#475569',
    fontWeight: '600',
  },
  playersRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  name: {
    flex: 1,
    fontSize: 24,
    color: '#0F172A',
    fontWeight: '800',
  },
  nameCompact: {
    fontSize: 20,
  },
  score: {
    fontSize: 72,
    lineHeight: 78,
    color: '#0F172A',
    fontWeight: '900',
    minWidth: 74,
    textAlign: 'right',
  },
  scoreCompact: {
    fontSize: 52,
    lineHeight: 58,
    minWidth: 56,
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 999,
  },
  dotLive: {
    backgroundColor: '#2E7D32',
  },
  dotScheduled: {
    backgroundColor: '#7A7A7A',
  },
  textDark: {
    color: '#F8FAFC',
  },
});
