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
          variant="secondary"
          label={deleting ? 'Deleting...' : 'Delete'}
          style={[styles.action, styles.actionDanger]}
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
    borderColor: 'rgba(59, 130, 246, 0.3)', // Default Blue
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    borderRadius: theme.radius.full,
    paddingHorizontal: 12,
    paddingVertical: 6,
    ...(typeof window !== 'undefined' && {
      backdropFilter: 'blur(8px)',
    }),
  },
  statusChipActive: {
    borderColor: 'rgba(16, 185, 129, 0.4)', // Neon Green
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
  },
  statusChipCompleted: {
    borderColor: 'rgba(148, 163, 184, 0.4)', // Slate
    backgroundColor: 'rgba(148, 163, 184, 0.15)',
  },
  statusText: {
    color: '#E2E8F0', // Slate 200
    fontWeight: '800',
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
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
  actionDanger: {
    borderColor: 'rgba(239, 68, 68, 0.3)',
    backgroundColor: 'rgba(239, 68, 68, 0.05)',
  },
});
