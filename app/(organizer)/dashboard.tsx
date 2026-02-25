import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { router } from 'expo-router';

import { AppButton } from '@/components/ui/AppButton';
import { AppCard } from '@/components/ui/AppCard';
import { TournamentCard } from '@/components/tournament/TournamentCard';
import { theme } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { deleteTournament, subscribeToOrganizerTournaments } from '@/lib/firestore/tournaments';
import { type TournamentDocument } from '@/lib/firestore/types';

export default function OrganizerDashboardScreen() {
  const { user, loading: authLoading, logout } = useAuth();
  const { width } = useWindowDimensions();
  const isCompact = width < 760;
  const organizerUser = user && !user.isAnonymous ? user : null;
  const [tournaments, setTournaments] = useState<TournamentDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const stats = useMemo(() => {
    const drafts = tournaments.filter((item) => item.status === 'draft').length;
    const active = tournaments.filter(
      (item) => item.status === 'group_stage' || item.status === 'knockout'
    ).length;
    const completed = tournaments.filter((item) => item.status === 'completed').length;

    return [
      { label: 'Total Tournaments', value: tournaments.length, tone: 'default' as const },
      { label: 'Active Now', value: active, tone: 'active' as const },
      { label: 'Drafts', value: drafts, tone: 'draft' as const },
      { label: 'Completed', value: completed, tone: 'completed' as const },
    ];
  }, [tournaments]);

  useEffect(() => {
    if (!organizerUser?.uid) {
      setTournaments([]);
      setLoading(false);
      return;
    }

    const unsubscribe = subscribeToOrganizerTournaments(organizerUser.uid, (docs) => {
      setTournaments(docs);
      setLoading(false);
    });

    return unsubscribe;
  }, [organizerUser?.uid]);

  if (authLoading || loading) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator size="large" />
      </SafeAreaView>
    );
  }

  if (!organizerUser) {
    return (
      <SafeAreaView style={styles.centered}>
        <AppCard style={styles.authCard}>
          <Text style={styles.title}>Organizer Dashboard</Text>
          <Text style={styles.subtitle}>Log in to view and manage tournaments.</Text>
          <AppButton label="Go to Login" onPress={() => router.push('/(auth)/login')} />
        </AppCard>
      </SafeAreaView>
    );
  }

  const runDelete = async (tournamentId: string) => {
    try {
      setDeleteError(null);
      setDeletingId(tournamentId);
      await deleteTournament(tournamentId);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delete tournament';
      setDeleteError(message);
    } finally {
      setDeletingId(null);
    }
  };

  const handleDelete = (tournament: TournamentDocument) => {
    const message = `Delete "${tournament.name}"? This cannot be undone.`;

    if (Platform.OS === 'web') {
      const confirmed = globalThis.confirm(message);
      if (confirmed) {
        void runDelete(tournament.id);
      }
      return;
    }

    Alert.alert('Delete Tournament?', message, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => void runDelete(tournament.id) },
    ]);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View pointerEvents="none" style={styles.backgroundLayer}>
        <View style={[styles.glowOrb, styles.glowOrbTop]} />
        <View style={[styles.glowOrb, styles.glowOrbBottom]} />
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <AppCard style={styles.headerCard}>
          <View style={[styles.headerRow, isCompact && styles.headerRowStacked]}>
            <View style={styles.headerCopy}>
              <Text style={styles.eyebrow}>Tournament Control Center</Text>
              <Text style={styles.title}>Organizer Dashboard</Text>
              <Text style={styles.subtitle}>
                Create tournaments, manage players, and publish results with a cleaner workflow.
              </Text>
            </View>
            <View style={[styles.toolbar, isCompact && styles.toolbarStack]}>
              <AppButton
                variant="secondary"
                label="Log Out"
                onPress={() => void logout()}
                style={styles.toolbarButton}
                labelStyle={styles.logoutText}
              />
              <AppButton
                label="+ Create Tournament"
                onPress={() => router.push('/(organizer)/new-tournament')}
                style={styles.toolbarButton}
              />
            </View>
          </View>
          <View style={styles.statsGrid}>
            {stats.map((item) => (
              <View
                key={item.label}
                style={[
                  styles.statTile,
                  item.tone === 'active' && styles.statTileActive,
                  item.tone === 'draft' && styles.statTileDraft,
                  item.tone === 'completed' && styles.statTileCompleted,
                ]}
              >
                <Text style={styles.statValue}>{item.value}</Text>
                <Text style={styles.statLabel}>{item.label}</Text>
              </View>
            ))}
          </View>
        </AppCard>

        {deleteError ? <Text style={styles.errorText}>{deleteError}</Text> : null}

        <View style={styles.sectionHeadingRow}>
          <Text style={styles.sectionHeading}>Your Tournaments</Text>
          <Text style={styles.sectionSubHeading}>
            {tournaments.length === 0
              ? 'No tournaments created yet'
              : `${tournaments.length} tournament${tournaments.length === 1 ? '' : 's'}`}
          </Text>
        </View>

        {tournaments.length === 0 ? (
          <AppCard style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No tournaments yet</Text>
            <Text style={styles.emptyText}>
              Start by creating your first tournament to unlock scheduling and live results.
            </Text>
            <AppButton
              label="Create Your First Tournament"
              onPress={() => router.push('/(organizer)/new-tournament')}
            />
          </AppCard>
        ) : (
          <View style={styles.tournamentList}>
            {tournaments.map((tournament) => (
              <TournamentCard
                key={tournament.id}
                tournament={tournament}
                deleting={deletingId === tournament.id}
                onManage={() =>
                  router.push({
                    pathname: '/(organizer)/[id]/manage',
                    params: { id: tournament.id },
                  })
                }
                onResults={() =>
                  router.push({
                    pathname: '/(organizer)/[id]/results',
                    params: { id: tournament.id },
                  })
                }
                onDelete={() => handleDelete(tournament)}
              />
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  backgroundLayer: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  glowOrb: {
    position: 'absolute',
    borderRadius: theme.radius.full,
    opacity: 0.25,
  },
  glowOrbTop: {
    width: 340,
    height: 340,
    top: -120,
    right: -100,
    backgroundColor: '#BAE6FD',
  },
  glowOrbBottom: {
    width: 300,
    height: 300,
    bottom: -120,
    left: -120,
    backgroundColor: '#99F6E4',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.background,
    padding: 24,
    gap: 8,
  },
  content: {
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
    paddingBottom: 34,
    maxWidth: 1160,
    width: '100%',
    alignSelf: 'center',
  },
  authCard: {
    width: '100%',
    maxWidth: 420,
  },
  headerCard: {
    gap: theme.spacing.lg,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: theme.spacing.md,
  },
  headerRowStacked: {
    flexDirection: 'column',
  },
  headerCopy: {
    flex: 1,
    gap: 6,
  },
  eyebrow: {
    color: theme.colors.accent,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontSize: 12,
  },
  title: {
    fontSize: 30,
    fontWeight: '900',
    color: theme.colors.text,
  },
  subtitle: {
    color: theme.colors.textMuted,
    fontWeight: '600',
    lineHeight: 22,
  },
  toolbar: {
    flexDirection: 'row',
    gap: 8,
    width: '100%',
    maxWidth: 420,
  },
  toolbarStack: {
    flexDirection: 'column',
    maxWidth: '100%',
  },
  toolbarButton: {
    flex: 1,
  },
  logoutText: {
    color: theme.colors.danger,
    fontWeight: '800',
  },
  errorText: {
    color: theme.colors.danger,
    fontWeight: '700',
    backgroundColor: theme.colors.dangerSoft,
    borderWidth: 1,
    borderColor: '#FDA4AF',
    borderRadius: theme.radius.md,
    padding: 10,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  statTile: {
    flexGrow: 1,
    flexBasis: 150,
    minHeight: 92,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: '#DBEAFE',
    backgroundColor: '#F8FAFC',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    justifyContent: 'center',
    gap: 4,
  },
  statTileActive: {
    borderColor: '#99F6E4',
    backgroundColor: '#ECFEFF',
  },
  statTileDraft: {
    borderColor: '#BFDBFE',
    backgroundColor: '#EFF6FF',
  },
  statTileCompleted: {
    borderColor: '#BBF7D0',
    backgroundColor: '#F0FDF4',
  },
  statValue: {
    color: theme.colors.text,
    fontWeight: '900',
    fontSize: 28,
  },
  statLabel: {
    color: theme.colors.textMuted,
    fontWeight: '700',
    fontSize: 13,
  },
  sectionHeadingRow: {
    gap: 4,
  },
  sectionHeading: {
    color: theme.colors.text,
    fontWeight: '800',
    fontSize: 19,
  },
  sectionSubHeading: {
    color: theme.colors.textMuted,
    fontWeight: '600',
    fontSize: 13,
  },
  tournamentList: {
    gap: theme.spacing.sm,
  },
  emptyCard: {
    gap: theme.spacing.md,
  },
  emptyTitle: {
    color: theme.colors.text,
    fontWeight: '800',
    fontSize: 20,
  },
  emptyText: {
    color: theme.colors.textMuted,
    fontWeight: '600',
    lineHeight: 21,
  },
});
