import { StyleSheet, Text, View } from 'react-native';

import { AppCard } from '@/components/ui/AppCard';
import { theme, toCategoryLabel } from '@/constants/theme';
import { type MatchCategory } from '@/lib/firestore/types';
import { type Standing } from '@/lib/schedule-generator';

type GroupStandingsTableProps = {
  category: MatchCategory;
  groupId: string;
  standings: Standing[];
};

export function GroupStandingsTable({ category, groupId, standings }: GroupStandingsTableProps) {
  return (
    <AppCard>
      <Text style={styles.groupTitle}>
        {toCategoryLabel(category)} - Group {groupId}
      </Text>
      <View style={styles.tableHeader}>
        <Text style={[styles.tableCell, styles.rankCol]}>#</Text>
        <Text style={[styles.tableCell, styles.nameCol]}>Name</Text>
        <Text style={styles.tableCell}>P</Text>
        <Text style={styles.tableCell}>W</Text>
        <Text style={styles.tableCell}>L</Text>
        <Text style={styles.tableCell}>Pts</Text>
      </View>
      {standings.map((row, index) => (
        <View key={row.id} style={styles.tableRow}>
          <Text style={[styles.tableCell, styles.rankCol]}>{index + 1}</Text>
          <Text style={[styles.tableCell, styles.nameCol]}>{row.name}</Text>
          <Text style={styles.tableCell}>{row.played}</Text>
          <Text style={styles.tableCell}>{row.wins}</Text>
          <Text style={styles.tableCell}>{row.losses}</Text>
          <Text style={styles.tableCell}>{row.points}</Text>
        </View>
      ))}
    </AppCard>
  );
}

const styles = StyleSheet.create({
  groupTitle: {
    fontWeight: '900',
    fontSize: 16,
    color: theme.colors.text,
  },
  tableHeader: {
    flexDirection: 'row',
    paddingVertical: 6,
    borderTopWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 4,
    borderTopWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  tableCell: {
    width: 30,
    textAlign: 'center',
    color: '#CBD5E1',
    fontWeight: '600',
  },
  rankCol: {
    width: 24,
  },
  nameCol: {
    flex: 1,
    textAlign: 'left',
    paddingLeft: 8,
  },
});
