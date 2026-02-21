import { StyleSheet, Text, View } from 'react-native';

import { AppButton } from '@/components/ui/AppButton';
import { AppCard } from '@/components/ui/AppCard';
import { theme, toTournamentStatusLabel } from '@/constants/theme';
import { type TournamentDocument } from '@/lib/firestore/types';

type TournamentCardProps = {
  tournament: TournamentDocument;
  deleting?: boolean;
  onManage?: () => void;
  onResults?: () => void;
  onDelete?: () => void;
};

export function TournamentCard({
  tournament,
  deleting = false,
  onManage,
  onResults,
  onDelete,
}: TournamentCardProps) {
  const statusLabel = toTournamentStatusLabel(tournament.status);

  return (
    <AppCard style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.titleWrap}>
          <Text style={styles.title}>{tournament.name}</Text>
          <Text style={styles.slug}>/{tournament.slug}</Text>
        </View>
        <View
          style={[
            styles.statusChip,
            tournament.status === 'group_stage' && styles.statusChipActive,
            tournament.status === 'knockout' && styles.statusChipActive,
            tournament.status === 'completed' && styles.statusChipCompleted,
          ]}
        >
          <Text style={styles.statusText}>{statusLabel}</Text>
        </View>
      </View>

      <View style={styles.actionsRow}>
        <AppButton
          variant="secondary"
          label="Manage"
          style={styles.action}
          onPress={onManage ?? (() => undefined)}
        />
        <AppButton
          label="Results"
          style={styles.action}
          onPress={onResults ?? (() => undefined)}
        />
        <AppButton
          variant="danger"
          label={deleting ? 'Deleting...' : 'Delete'}
          style={styles.action}
          disabled={deleting}
          onPress={onDelete ?? (() => undefined)}
        />
      </View>
    </AppCard>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: theme.spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: theme.spacing.sm,
  },
  titleWrap: {
    flex: 1,
    gap: 4,
  },
  title: {
    color: theme.colors.text,
    fontWeight: '900',
    fontSize: 20,
  },
  slug: {
    color: theme.colors.textMuted,
    fontWeight: '700',
    fontSize: 13,
  },
  statusChip: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    backgroundColor: '#EFF6FF',
    borderRadius: theme.radius.full,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  statusChipActive: {
    borderColor: '#99F6E4',
    backgroundColor: '#ECFEFF',
  },
  statusChipCompleted: {
    borderColor: '#BBF7D0',
    backgroundColor: '#F0FDF4',
  },
  statusText: {
    color: '#0F172A',
    fontWeight: '800',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  action: {
    minWidth: 116,
    flexGrow: 1,
  },
});
