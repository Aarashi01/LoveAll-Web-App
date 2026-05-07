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
              {toPlayerGenderLabel(player.gender)} · {player.categories.map(toCategoryLabel).join(', ')}
              {player.department ? ` · ${player.department}` : ''}
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
                <Pressable style={({ pressed }) => [styles.editButton, pressed && styles.btnPressed]} onPress={() => onEdit(player)}>
                  <Text style={styles.editButtonText}>Edit</Text>
                </Pressable>
              ) : null}
              {onDelete ? (
                <Pressable style={({ pressed }) => [styles.deleteButton, pressed && styles.btnPressed]} onPress={() => onDelete(player)}>
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
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  emptyText: {
    color: theme.colors.textMuted,
    fontWeight: '600',
    fontSize: 13,
  },
  playerRow: {
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    paddingHorizontal: 4,
    paddingVertical: 12,
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  playerInfo: {
    flex: 1,
    gap: 2,
  },
  playerName: {
    color: theme.colors.text,
    fontWeight: '800',
    fontSize: 15,
  },
  playerMeta: {
    color: theme.colors.textMuted,
    fontWeight: '500',
    fontSize: 12,
  },
  partnerMeta: {
    color: theme.colors.text,
    fontWeight: '700',
    fontSize: 12,
  },
  playerActions: {
    flexDirection: 'row',
    gap: 6,
  },
  editButton: {
    minHeight: 32,
    borderRadius: theme.radius.full,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: theme.colors.text,
    backgroundColor: theme.colors.surface,
  },
  editButtonText: {
    color: theme.colors.text,
    fontWeight: '800',
    fontSize: 12,
    letterSpacing: 0.4,
  },
  deleteButton: {
    minHeight: 32,
    borderRadius: theme.radius.full,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.danger,
  },
  deleteButtonText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 12,
    letterSpacing: 0.4,
  },
  btnPressed: {
    opacity: 0.85,
  },
});
