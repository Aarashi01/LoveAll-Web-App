import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppCard } from '@/components/ui/AppCard';
import { toCategoryLabel, toRoundLabel } from '@/constants/theme';
import { type MatchDocument, type MatchRound } from '@/lib/firestore/types';

const ROUND_ORDER: MatchRound[] = ['R16', 'QF', 'SF', 'F', '3rd'];

type KnockoutBracketProps = {
  matches: MatchDocument[];
};

export function KnockoutBracket({ matches }: KnockoutBracketProps) {
  const grouped = useMemo(() => {
    const byRound = new Map<MatchRound, MatchDocument[]>();

    matches.forEach((match) => {
      if (!byRound.has(match.round)) byRound.set(match.round, []);
      byRound.get(match.round)?.push(match);
    });

    return ROUND_ORDER.filter((round) => byRound.has(round)).map((round) => ({
      round,
      matches: byRound.get(round) ?? [],
    }));
  }, [matches]);

  if (grouped.length === 0) {
    return <Text style={styles.emptyText}>Knockout bracket is not generated yet.</Text>;
  }

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
      <View style={styles.board}>
        {grouped.map((group: { round: MatchRound; matches: MatchDocument[] }, index: number) => (
          <View key={group.round} style={styles.roundColumn}>
            <View style={styles.roundHeader}>
              <Text style={styles.roundTitle}>{toRoundLabel(group.round)}</Text>
            </View>
            <View style={styles.matchList}>
              {group.matches.map((match: MatchDocument) => (
                <AppCard key={match.id} style={styles.matchCard}>
                  <View style={styles.matchMetaRow}>
                    <Text style={styles.metaCategory}>{toCategoryLabel(match.category)}</Text>
                    <View style={[styles.statusBadge, match.status === 'live' && styles.statusLive]}>
                      <Text style={[styles.statusText, match.status === 'live' && styles.statusTextLive]}>
                        {match.status.toUpperCase()}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.playersContainer}>
                    <View style={[styles.playerRow, match.winnerId === match.player1Id && styles.winnerRow]}>
                      <Text style={[styles.playerName, match.winnerId === match.player1Id && styles.winnerName]}>
                        {match.player1Name}
                      </Text>
                    </View>
                    <View style={styles.divider} />
                    <View style={[styles.playerRow, match.winnerId === match.player2Id && styles.winnerRow]}>
                      <Text style={[styles.playerName, match.winnerId === match.player2Id && styles.winnerName]}>
                        {match.player2Name}
                      </Text>
                    </View>
                  </View>
                </AppCard>
              ))}
            </View>

            {/* Draw connector lines if not the last round */}
            {index < grouped.length - 1 && (
              <View style={styles.connectorColumn}>
                {/* Simplified connector visual for web layout */}
              </View>
            )}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingVertical: 16,
    paddingHorizontal: 8,
  },
  board: {
    flexDirection: 'row',
    gap: 48,
    alignItems: 'flex-start',
  },
  roundColumn: {
    width: 280,
    gap: 16,
  },
  roundHeader: {
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    ...(typeof window !== 'undefined' && {
      backdropFilter: 'blur(12px)',
    }),
  },
  roundTitle: {
    color: '#F8FAFC',
    fontWeight: '900',
    fontSize: 16,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  matchList: {
    gap: 24,
    justifyContent: 'space-around',
    flex: 1,
  },
  matchCard: {
    padding: 0,
    backgroundColor: 'rgba(30, 41, 59, 0.8)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    overflow: 'hidden',
    ...(typeof window !== 'undefined' && {
      boxShadow: '0 4px 20px 0 rgba(0, 0, 0, 0.15)',
      transition: 'transform 0.2s ease',
    }),
  },
  matchMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  metaCategory: {
    fontSize: 12,
    fontWeight: '800',
    color: '#94A3B8',
    textTransform: 'uppercase',
  },
  statusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: 'rgba(148, 163, 184, 0.2)',
  },
  statusLive: {
    backgroundColor: '#10B981',
  },
  statusText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#94A3B8',
  },
  statusTextLive: {
    color: '#FFFFFF',
  },
  playersContainer: {
    paddingVertical: 8,
  },
  playerRow: {
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  playerName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#CBD5E1',
  },
  winnerRow: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
  },
  winnerName: {
    color: '#10B981',
    fontWeight: '900',
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    marginHorizontal: 16,
  },
  connectorColumn: {
    width: 48,
  },
  emptyText: {
    color: '#94A3B8',
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 40,
    fontSize: 16,
  },
});
