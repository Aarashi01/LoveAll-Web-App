import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { theme } from '@/constants/theme';
import { type ScoreGame } from '@/lib/firestore/types';

type MatchScoreGridProps = {
  scores: ScoreGame[];
};

const COLS_PER_ROW = 8;

function ScoreGridSection({ game, defaultExpanded }: { game: ScoreGame; defaultExpanded: boolean }) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const history = game.pointHistory ?? [];
  const gameNum = game.gameNumber;
  const headerLabel = `${gameNum === 1 ? 'First' : gameNum === 2 ? 'Second' : 'Third'} set ${game.p1Score} - ${game.p2Score}`;

  if (history.length === 0) {
    return (
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{headerLabel}</Text>
        </View>
        <Text style={styles.noDataText}>Point-by-point data not available</Text>
      </View>
    );
  }

  // Chunk history rows for display
  const chunks: [number, number][][] = [];
  for (let i = 0; i < history.length; i += COLS_PER_ROW) {
    chunks.push(history.slice(i, i + COLS_PER_ROW));
  }

  return (
    <View style={styles.section}>
      <Pressable style={styles.sectionHeader} onPress={() => setExpanded(!expanded)}>
        <Text style={styles.sectionTitle}>{headerLabel}</Text>
        <Text style={styles.chevron}>{expanded ? '▲' : '▼'}</Text>
      </Pressable>

      {expanded ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.gridContainer}>
            {/* Final score column */}
            <View style={styles.finalScoreCol}>
              <View style={styles.finalScoreCell}>
                <Text style={[styles.finalScoreText, game.winner === 'p1' && styles.winnerText]}>
                  {game.p1Score}
                </Text>
              </View>
              <View style={styles.finalScoreCell}>
                <Text style={[styles.finalScoreText, game.winner === 'p2' && styles.winnerText]}>
                  {game.p2Score}
                </Text>
              </View>
            </View>

            {/* Point-by-point columns */}
            {chunks.map((chunk, chunkIdx) => (
              <View key={chunkIdx} style={styles.chunkGroup}>
                {/* P1 row */}
                <View style={styles.gridRow}>
                  {chunk.map(([p1Score], colIdx) => {
                    const globalIdx = chunkIdx * COLS_PER_ROW + colIdx;
                    const prevP1 = globalIdx > 0 ? history[globalIdx - 1][0] : 0;
                    const isScorer = p1Score > prevP1;
                    return (
                      <View key={`p1-${globalIdx}`} style={styles.gridCell}>
                        <Text style={[styles.gridText, isScorer && styles.scorerText]}>
                          {p1Score}
                        </Text>
                      </View>
                    );
                  })}
                </View>
                {/* P2 row */}
                <View style={styles.gridRow}>
                  {chunk.map(([, p2Score], colIdx) => {
                    const globalIdx = chunkIdx * COLS_PER_ROW + colIdx;
                    const prevP2 = globalIdx > 0 ? history[globalIdx - 1][1] : 0;
                    const isScorer = p2Score > prevP2;
                    return (
                      <View key={`p2-${globalIdx}`} style={styles.gridCell}>
                        <Text style={[styles.gridText, isScorer && styles.scorerText]}>
                          {p2Score}
                        </Text>
                      </View>
                    );
                  })}
                </View>
                {/* Separator between chunks (visual only) */}
                {chunkIdx < chunks.length - 1 ? <View style={styles.chunkDivider} /> : null}
              </View>
            ))}
          </View>
        </ScrollView>
      ) : null}
    </View>
  );
}

export function MatchScoreGrid({ scores }: MatchScoreGridProps) {
  if (scores.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.noDataText}>No game data available.</Text>
      </View>
    );
  }

  // Show games in reverse order (most recent first) like SofaScore
  const reversedScores = [...scores].reverse();

  return (
    <View style={styles.container}>
      {reversedScores.map((game, idx) => (
        <ScoreGridSection
          key={game.gameNumber}
          game={game}
          defaultExpanded={idx === 0}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 8,
  },
  emptyContainer: {
    paddingVertical: 20,
  },
  section: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    overflow: 'hidden',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    gap: 8,
    ...(typeof window !== 'undefined' && ({ cursor: 'pointer' } as any)),
  },
  sectionTitle: {
    color: theme.colors.text,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  chevron: {
    color: theme.colors.textMuted,
    fontSize: 10,
  },
  noDataText: {
    color: theme.colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    paddingVertical: 16,
  },
  gridContainer: {
    flexDirection: 'row',
    paddingVertical: 8,
    paddingHorizontal: 8,
    gap: 4,
  },
  finalScoreCol: {
    gap: 2,
    marginRight: 8,
    borderRightWidth: 1,
    borderRightColor: theme.colors.border,
    paddingRight: 10,
    justifyContent: 'center',
  },
  finalScoreCell: {
    paddingVertical: 4,
    paddingHorizontal: 4,
    alignItems: 'center',
  },
  finalScoreText: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  winnerText: {
    color: theme.colors.text,
    fontWeight: '900',
  },
  chunkGroup: { gap: 2 },
  gridRow: { flexDirection: 'row' },
  gridCell: {
    width: 30,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridText: {
    color: theme.colors.textMuted,
    fontSize: 13,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  scorerText: {
    color: theme.colors.text,
    fontWeight: '900',
  },
  chunkDivider: {
    height: 1,
    backgroundColor: theme.colors.border,
    marginVertical: 4,
  },
});
