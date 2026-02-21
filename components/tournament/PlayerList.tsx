import { Pressable, StyleSheet, Text, View } from 'react-native';

import { theme, toCategoryLabel, toPlayerGenderLabel } from '@/constants/theme';
import { type PlayerDocument } from '@/lib/firestore/types';

type PlayerListProps = {
  players: PlayerDocument[];
  allPlayers?: PlayerDocument[];
  emptyLabel?: string;
  onEdit?: (player: PlayerDocument) => void;
  onDelete?: (player: PlayerDocument) => void;
};

export function PlayerList({
  players,
  allPlayers,
  emptyLabel = 'No players added yet.',
  onEdit,
  onDelete,
}: PlayerListProps) {
  if (players.length === 0) {
    return <Text style={styles.emptyText}>{emptyLabel}</Text>;
  }

  const source = allPlayers ?? players;

  return (
    <View style={styles.list}>
      {players.map((player) => (
        <View key={player.id} style={styles.playerRow}>
          <View style={styles.playerInfo}>
            <Text style={styles.playerName}>{player.name}</Text>
            <Text style={styles.playerMeta}>
              {toPlayerGenderLabel(player.gender)} | {player.categories.map(toCategoryLabel).join(', ')}
              {player.department ? ` | ${player.department}` : ''}
            </Text>
            {player.partnerId ? (
              <Text style={styles.partnerMeta}>
                Partner: {source.find((candidate) => candidate.id === player.partnerId)?.name ?? 'Linked'}
              </Text>
            ) : null}
          </View>

          {(onEdit || onDelete) && (
            <View style={styles.playerActions}>
              {onEdit ? (
                <Pressable style={styles.editButton} onPress={() => onEdit(player)}>
                  <Text style={styles.editButtonText}>Edit</Text>
                </Pressable>
              ) : null}
              {onDelete ? (
                <Pressable style={styles.deleteButton} onPress={() => onDelete(player)}>
                  <Text style={styles.deleteButtonText}>Delete</Text>
                </Pressable>
              ) : null}
            </View>
          )}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: 8,
  },
  emptyText: {
    color: '#64748B',
    fontWeight: '700',
  },
  playerRow: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    padding: 10,
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  playerInfo: {
    flex: 1,
    gap: 2,
  },
  playerName: {
    color: theme.colors.text,
    fontWeight: '900',
  },
  playerMeta: {
    color: '#475569',
    fontWeight: '600',
    fontSize: 12,
  },
  partnerMeta: {
    color: '#166534',
    fontWeight: '700',
    fontSize: 12,
  },
  playerActions: {
    gap: 6,
  },
  editButton: {
    minHeight: 36,
    borderRadius: 8,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0EA5E9',
  },
  editButtonText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 12,
  },
  deleteButton: {
    minHeight: 36,
    borderRadius: 8,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#B91C1C',
  },
  deleteButtonText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 12,
  },
});
