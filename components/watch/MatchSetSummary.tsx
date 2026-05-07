import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { theme } from '@/constants/theme';
import { type MatchDocument } from '@/lib/firestore/types';

type MatchSetSummaryProps = {
  match: MatchDocument;
};

export function MatchSetSummary({ match }: MatchSetSummaryProps) {
  const completedGames = match.scores.filter((g) => g.winner !== null);
  const totalGames = match.scores.length;

  if (totalGames === 0) {
    return (
      <View style={styles.container}>
        <Text style={styles.emptyText}>No set data available yet.</Text>
      </View>
    );
  }

  const headers = match.scores.map((_, i) => {
    const num = i + 1;
    return num === 1 ? '1st' : num === 2 ? '2nd' : `${num}rd`;
  });

  return (
    <View style={styles.container}>
      {/* Header row */}
      <View style={styles.row}>
        <View style={styles.emptyCell} />
        {headers.map((label) => (
          <View key={label} style={styles.headerCell}>
            <Text style={styles.headerText}>{label}</Text>
          </View>
        ))}
      </View>

      {/* Player 1 row */}
      <View style={styles.row}>
        <View style={styles.emptyCell} />
        {match.scores.map((game, index) => {
          const isWinner = game.winner === 'p1';
          const isLoser = game.winner === 'p2';
          return (
            <View key={`p1-${index}`} style={styles.scoreCell}>
              <Text
                style={[
                  styles.scoreText,
                  isWinner && styles.winnerText,
                  isLoser && styles.loserText,
                ]}
              >
                {game.p1Score}
              </Text>
            </View>
          );
        })}
      </View>

      {/* Player 2 row */}
      <View style={styles.row}>
        <View style={styles.emptyCell} />
        {match.scores.map((game, index) => {
          const isWinner = game.winner === 'p2';
          const isLoser = game.winner === 'p1';
          return (
            <View key={`p2-${index}`} style={styles.scoreCell}>
              <Text
                style={[
                  styles.scoreText,
                  isWinner && styles.winnerText,
                  isLoser && styles.loserText,
                ]}
              >
                {game.p2Score}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.lg,
    gap: 4,
  },
  emptyText: {
    color: theme.colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
    paddingVertical: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  emptyCell: {
    width: 40,
  },
  headerCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 6,
  },
  headerText: {
    color: theme.colors.textMuted,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  scoreCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 6,
  },
  scoreText: {
    color: theme.colors.text,
    fontSize: 18,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  winnerText: {
    color: theme.colors.text,
    fontWeight: '900',
  },
  loserText: {
    color: theme.colors.textMuted,
  },
});
