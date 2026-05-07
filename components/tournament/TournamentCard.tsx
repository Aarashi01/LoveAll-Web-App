import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '@/components/ui/AppButton';
import { theme, toTournamentStatusLabel } from '@/constants/theme';
import { type TournamentDocument } from '@/lib/firestore/types';

type TournamentCardProps = {
  tournament: TournamentDocument;
  onManage?: () => void;
  onResults?: () => void;
  onWatchParty?: () => void;
};

function getStatusStyle(status: TournamentDocument['status']) {
  if (status === 'group_stage' || status === 'knockout') return 'active';
  if (status === 'completed') return 'completed';
  return 'draft';
}

export function TournamentCard({
  tournament,
  onManage,
  onResults,
  onWatchParty,
}: TournamentCardProps) {
  const statusLabel = toTournamentStatusLabel(tournament.status);
  const statusStyle = getStatusStyle(tournament.status);
  const isActive = statusStyle === 'active';
  const isCompleted = statusStyle === 'completed';

  return (
    <View style={styles.card}>
      <View style={styles.statusBar}>
        <View style={styles.statusGroup}>
          <View
            style={[
              styles.statusDot,
              isActive && styles.statusDotActive,
              isCompleted && styles.statusDotCompleted,
            ]}
          />
          <Text style={styles.statusText}>{statusLabel.toUpperCase()}</Text>
        </View>
        <Text style={styles.visibilityText}>
          {tournament.publicViewEnabled ? 'PUBLIC' : 'PRIVATE'}
        </Text>
      </View>

      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={2}>{tournament.name}</Text>
        <Text style={styles.slug}>/{tournament.slug}</Text>
      </View>

      <View style={styles.actionsRow}>
        {!isCompleted && (
          <AppButton
            variant={isActive ? 'primary' : 'secondary'}
            label={isActive ? 'Manage · PIN' : 'Manage'}
            style={styles.action}
            onPress={onManage ?? (() => undefined)}
          />
        )}

        <AppButton
          variant={isCompleted ? 'primary' : 'secondary'}
          label="Results"
          style={styles.action}
          onPress={onResults ?? (() => undefined)}
        />

        {onWatchParty ? (
          <Pressable onPress={onWatchParty} style={({ pressed }) => [styles.watchLink, pressed && styles.watchLinkPressed]}>
            <Text style={styles.watchLinkText}>Watch Party →</Text>
          </Pressable>
        ) : null}
      </View>

      {isActive && (
        <Text style={styles.pinHint}>Venue PIN required to manage active tournaments.</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.surface,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing.xl,
    gap: theme.spacing.lg,
    ...(typeof window !== 'undefined' && ({
      transition: 'background-color 120ms ease',
    } as any)),
  },
  statusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statusGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.textMuted,
  },
  statusDotActive: {
    backgroundColor: theme.colors.live,
  },
  statusDotCompleted: {
    backgroundColor: theme.colors.success,
  },
  statusText: {
    color: theme.colors.text,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.4,
  },
  visibilityText: {
    color: theme.colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.4,
  },
  body: {
    gap: 4,
  },
  title: {
    color: theme.colors.text,
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -0.6,
    lineHeight: 32,
  },
  slug: {
    color: theme.colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 10,
  },
  action: {
    minWidth: 120,
  },
  watchLink: {
    paddingVertical: 12,
    paddingHorizontal: 4,
  },
  watchLinkPressed: {
    opacity: 0.6,
  },
  watchLinkText: {
    color: theme.colors.text,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.4,
    textDecorationLine: 'underline',
  },
  pinHint: {
    color: theme.colors.textMuted,
    fontSize: 12,
    fontWeight: '500',
  },
});
