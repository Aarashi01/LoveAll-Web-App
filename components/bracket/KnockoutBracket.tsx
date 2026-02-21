import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AppCard } from '@/components/ui/AppCard';
import { theme, toCategoryLabel, toRoundLabel } from '@/constants/theme';
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
    <View style={styles.column}>
      {grouped.map((group) => (
        <AppCard key={group.round}>
          <Text style={styles.roundTitle}>{toRoundLabel(group.round)}</Text>
          {group.matches.map((match) => (
            <View key={match.id} style={styles.matchRow}>
              <Text style={styles.pairing}>
                {match.player1Name} vs {match.player2Name}
              </Text>
              <Text style={styles.meta}>
                {toCategoryLabel(match.category)} | {match.status}
              </Text>
            </View>
          ))}
        </AppCard>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  column: {
    gap: 10,
  },
  roundTitle: {
    color: '#166534',
    fontWeight: '900',
  },
  matchRow: {
    borderWidth: 1,
    borderColor: '#DCFCE7',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: '#F0FDF4',
    gap: 2,
  },
  pairing: {
    color: theme.colors.text,
    fontWeight: '700',
  },
  meta: {
    color: '#475569',
    fontWeight: '600',
    fontSize: 12,
  },
  emptyText: {
    color: theme.colors.textMuted,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 28,
  },
});
