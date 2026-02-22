import { type ComponentProps, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';

import { AppButton } from '@/components/ui/AppButton';
import { AppCard } from '@/components/ui/AppCard';
import { TournamentCard } from '@/components/tournament/TournamentCard';
import { theme } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { deleteTournament, subscribeToOrganizerTournaments } from '@/lib/firestore/tournaments';
import { type TournamentDocument } from '@/lib/firestore/types';

type MaterialIconName = ComponentProps<typeof MaterialIcons>['name'];
type StatTone = 'default' | 'active' | 'draft' | 'completed';

type DashboardStat = {
  label: string;
  value: number;
  tone: StatTone;
  icon: MaterialIconName;
};

const palette = {
  primary: '#11D4D4',
  background: '#F6F8F8',
  backgroundSoft: '#EEF2F2',
  text: '#0F172A',
  textMuted: '#64748B',
  border: '#E2E8F0',
  panel: '#FFFFFF',
  panelSoft: '#F8FAFC',
  panelSoftAlt: '#F1F5F9',
  dangerBg: '#FFF1F2',
  dangerBorder: '#FECDD3',
  dangerText: '#BE123C',
};

export default function OrganizerDashboardScreen() {
  const { user, loading: authLoading, logout } = useAuth();
  const { width } = useWindowDimensions();
  const isCompact = width < 840;
  const isNarrow = width < 560;
  const organizerUser = user && !user.isAnonymous ? user : null;
  const [tournaments, setTournaments] = useState<TournamentDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const stats = useMemo<DashboardStat[]>(() => {
    const drafts = tournaments.filter((item) => item.status === 'draft').length;
    const active = tournaments.filter(
      (item) => item.status === 'group_stage' || item.status === 'knockout'
    ).length;
    const completed = tournaments.filter((item) => item.status === 'completed').length;

    return [
      { label: 'Total Tournaments', value: tournaments.length, tone: 'default', icon: 'emoji-events' },
      { label: 'Active Now', value: active, tone: 'active', icon: 'sensors' },
      { label: 'Drafts', value: drafts, tone: 'draft', icon: 'edit-note' },
      { label: 'Completed', value: completed, tone: 'completed', icon: 'check-circle' },
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
        <ActivityIndicator size="large" color={palette.primary} />
      </SafeAreaView>
    );
  }

  if (!organizerUser) {
    return (
      <SafeAreaView style={styles.centered}>
        <AppCard style={styles.authCard}>
          <Text style={styles.authTitle}>Organizer Dashboard</Text>
          <Text style={styles.authSubtitle}>Log in to view and manage tournaments.</Text>
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

  const handleSupport = async () => {
    const supportEmail = 'mailto:support@loveall.app?subject=Tournament%20Support';

    try {
      const canOpen = await Linking.canOpenURL(supportEmail);
      if (!canOpen) {
        Alert.alert('Support', 'Unable to open an email client on this device.');
        return;
      }
      await Linking.openURL(supportEmail);
    } catch {
      Alert.alert('Support', 'Unable to open support right now. Please try again later.');
    }
  };

  const handleDocs = () => {
    Alert.alert('Documentation', 'Organizer documentation will be available in an upcoming release.');
  };

  const profileInitial = organizerUser.email?.charAt(0).toUpperCase() ?? 'O';

  return (
    <SafeAreaView style={styles.safeArea}>
      <View pointerEvents="none" style={styles.backgroundLayer}>
        <View style={[styles.glowOrb, styles.glowOrbTop]} />
        <View style={[styles.glowOrb, styles.glowOrbBottom]} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={[styles.topNav, isCompact && styles.topNavStack]}>
          <View style={styles.logoSection}>
            <View style={styles.logoBadge}>
              <MaterialIcons name="sports-esports" size={20} color={palette.text} />
            </View>
            <Text style={styles.logoText}>
              Tournament <Text style={styles.logoAccent}>Control Center</Text>
            </Text>
          </View>

          <View style={[styles.navActions, isNarrow && styles.navActionsCompact]}>
            <Pressable style={styles.linkButton} onPress={() => void handleSupport()}>
              <MaterialIcons name="help-outline" size={18} color={palette.textMuted} />
              {!isNarrow ? <Text style={styles.linkButtonText}>Support</Text> : null}
            </Pressable>

            <View style={styles.navDivider} />

            <Pressable style={styles.logoutButton} onPress={() => void logout()}>
              <MaterialIcons name="logout" size={18} color={palette.text} />
              {!isNarrow ? <Text style={styles.logoutButtonText}>Log Out</Text> : null}
            </Pressable>

            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{profileInitial}</Text>
            </View>
          </View>
        </View>

        <View style={[styles.heroRow, isCompact && styles.heroRowStacked]}>
          <View style={styles.heroCopy}>
            <Text style={styles.heroTitle}>Organizer Dashboard</Text>
            <Text style={styles.heroSubtitle}>
              Manage your competitive events, registrations, and match progress from one control
              center.
            </Text>
          </View>

          <Pressable style={[styles.createButton, isNarrow && styles.fullWidthButton]} onPress={() => router.push('/(organizer)/new-tournament')}>
            <MaterialIcons name="add" size={20} color={palette.text} />
            <Text style={styles.createButtonText}>Create Tournament</Text>
          </Pressable>
        </View>

        <View style={styles.statsGrid}>
          {stats.map((item) => (
            <View
              key={item.label}
              style={[
                styles.statCard,
                item.tone === 'active' && styles.statCardActive,
                item.tone === 'draft' && styles.statCardMuted,
                item.tone === 'completed' && styles.statCardMuted,
              ]}
            >
              <View style={styles.statRow}>
                <View style={styles.statCopy}>
                  <Text style={styles.statLabel}>{item.label}</Text>
                  <Text style={[styles.statValue, item.tone === 'active' && styles.statValueActive]}>
                    {item.value}
                  </Text>
                </View>
                <View
                  style={[
                    styles.statIconWrap,
                    item.tone === 'default' && styles.statIconPrimary,
                    item.tone === 'active' && styles.statIconPrimary,
                    item.tone === 'draft' && styles.statIconMuted,
                    item.tone === 'completed' && styles.statIconMuted,
                  ]}
                >
                  <MaterialIcons
                    name={item.icon}
                    size={24}
                    color={item.tone === 'draft' || item.tone === 'completed' ? '#64748B' : '#0891B2'}
                  />
                </View>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.panel}>
          <View style={styles.panelTopBar}>
            <View style={styles.panelTitleRow}>
              <Text style={styles.panelTitle}>Your Tournaments</Text>
              <View style={styles.panelBadge}>
                <Text style={styles.panelBadgeText}>
                  {tournaments.length === 0 ? 'Empty' : `${tournaments.length}`}
                </Text>
              </View>
            </View>
            <View style={styles.windowDots}>
              <View style={styles.windowDot} />
              <View style={styles.windowDot} />
              <View style={styles.windowDot} />
            </View>
          </View>

          {deleteError ? (
            <View style={styles.errorBanner}>
              <MaterialIcons name="error-outline" size={18} color={palette.dangerText} />
              <Text style={styles.errorText}>{deleteError}</Text>
            </View>
          ) : null}

          {tournaments.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyArtWrap}>
                <View style={styles.emptyGlow} />
                <View style={styles.emptyCircle}>
                  <MaterialIcons name="sports-score" size={68} color="#CBD5E1" />
                  <View style={styles.emptyBadge}>
                    <MaterialIcons name="add-task" size={26} color="#FFFFFF" />
                  </View>
                </View>
              </View>

              <Text style={styles.emptyTitle}>No Tournaments Found</Text>
              <Text style={styles.emptySubtitle}>
                Ready to start your first competition? Set up brackets, define rules, and manage
                participants in minutes.
              </Text>

              <View style={[styles.emptyActionRow, isNarrow && styles.emptyActionRowStacked]}>
                <Pressable
                  style={[styles.emptyPrimaryButton, isNarrow && styles.fullWidthButton]}
                  onPress={() => router.push('/(organizer)/new-tournament')}
                >
                  <MaterialIcons name="rocket-launch" size={18} color={palette.text} />
                  <Text style={styles.emptyPrimaryButtonText}>Create Your First Tournament</Text>
                </Pressable>

                <Pressable
                  style={[styles.emptySecondaryButton, isNarrow && styles.fullWidthButton]}
                  onPress={handleDocs}
                >
                  <MaterialIcons name="menu-book" size={18} color={palette.text} />
                  <Text style={styles.emptySecondaryButtonText}>View Documentation</Text>
                </Pressable>
              </View>
            </View>
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
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: palette.background,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.background,
    padding: theme.spacing.lg,
  },
  authCard: {
    width: '100%',
    maxWidth: 420,
  },
  authTitle: {
    color: palette.text,
    fontWeight: '900',
    fontSize: 24,
  },
  authSubtitle: {
    color: palette.textMuted,
    fontWeight: '600',
    lineHeight: 21,
  },
  backgroundLayer: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
    backgroundColor: palette.backgroundSoft,
  },
  glowOrb: {
    position: 'absolute',
    borderRadius: theme.radius.full,
    opacity: 0.22,
  },
  glowOrbTop: {
    width: 360,
    height: 360,
    top: -170,
    right: -120,
    backgroundColor: '#A5F3FC',
  },
  glowOrbBottom: {
    width: 300,
    height: 300,
    bottom: -150,
    left: -120,
    backgroundColor: '#CCFBF1',
  },
  content: {
    width: '100%',
    maxWidth: 1160,
    alignSelf: 'center',
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.lg,
    paddingBottom: 40,
    gap: theme.spacing.lg,
  },
  topNav: {
    backgroundColor: '#FFFFFFD8',
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: theme.radius.xl,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.sm,
  },
  topNavStack: {
    flexDirection: 'column',
    alignItems: 'stretch',
  },
  logoSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  logoBadge: {
    width: 38,
    height: 38,
    borderRadius: theme.radius.md,
    backgroundColor: palette.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: {
    color: palette.text,
    fontWeight: '900',
    fontSize: 19,
  },
  logoAccent: {
    color: '#0891B2',
  },
  navActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  navActionsCompact: {
    justifyContent: 'space-between',
  },
  linkButton: {
    minHeight: 38,
    borderRadius: theme.radius.lg,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  linkButtonText: {
    color: palette.textMuted,
    fontWeight: '700',
    fontSize: 13,
  },
  navDivider: {
    width: 1,
    alignSelf: 'stretch',
    backgroundColor: palette.border,
  },
  logoutButton: {
    minHeight: 38,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: palette.border,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
    backgroundColor: palette.panel,
  },
  logoutButtonText: {
    color: palette.text,
    fontWeight: '800',
    fontSize: 13,
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: theme.radius.full,
    borderWidth: 2,
    borderColor: palette.primary,
    backgroundColor: '#BAF4F4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: palette.text,
    fontWeight: '900',
    fontSize: 15,
  },
  heroRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    gap: theme.spacing.md,
  },
  heroRowStacked: {
    flexDirection: 'column',
    alignItems: 'stretch',
  },
  heroCopy: {
    flex: 1,
    gap: 6,
  },
  heroTitle: {
    color: palette.text,
    fontWeight: '900',
    fontSize: 38,
    lineHeight: 44,
  },
  heroSubtitle: {
    color: palette.textMuted,
    fontWeight: '500',
    fontSize: 16,
    lineHeight: 24,
    maxWidth: 680,
  },
  createButton: {
    minHeight: 48,
    borderRadius: theme.radius.lg,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: palette.primary,
    shadowColor: '#0891B2',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.22,
    shadowRadius: 14,
    elevation: 3,
  },
  createButtonText: {
    color: palette.text,
    fontWeight: '900',
    fontSize: 15,
  },
  fullWidthButton: {
    width: '100%',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.md,
  },
  statCard: {
    flexGrow: 1,
    flexBasis: 220,
    minHeight: 124,
    borderRadius: theme.radius.xl,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.panel,
    padding: theme.spacing.lg,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
  },
  statCardActive: {
    borderColor: '#A5F3FC',
  },
  statCardMuted: {
    backgroundColor: '#FFFFFFCC',
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: theme.spacing.md,
  },
  statCopy: {
    flex: 1,
    gap: 6,
  },
  statLabel: {
    color: palette.textMuted,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  statValue: {
    color: palette.text,
    fontSize: 33,
    fontWeight: '900',
    lineHeight: 36,
  },
  statValueActive: {
    color: '#0891B2',
  },
  statIconWrap: {
    width: 52,
    height: 52,
    borderRadius: theme.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statIconPrimary: {
    backgroundColor: '#CFFAFE',
  },
  statIconMuted: {
    backgroundColor: palette.panelSoftAlt,
  },
  panel: {
    backgroundColor: palette.panel,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: palette.border,
    overflow: 'hidden',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.1,
    shadowRadius: 24,
    elevation: 4,
  },
  panelTopBar: {
    minHeight: 58,
    backgroundColor: '#F8FAFCDE',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  panelTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  panelTitle: {
    color: '#334155',
    fontWeight: '800',
    fontSize: 14,
  },
  panelBadge: {
    borderRadius: theme.radius.md,
    backgroundColor: '#E2E8F0',
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  panelBadgeText: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  windowDots: {
    flexDirection: 'row',
    gap: 6,
  },
  windowDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
    backgroundColor: '#E2E8F0',
  },
  errorBanner: {
    marginTop: theme.spacing.md,
    marginHorizontal: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    borderWidth: 1,
    borderColor: palette.dangerBorder,
    borderRadius: theme.radius.md,
    backgroundColor: palette.dangerBg,
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  errorText: {
    color: palette.dangerText,
    fontWeight: '700',
    flex: 1,
    fontSize: 13,
  },
  emptyState: {
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: 48,
    gap: theme.spacing.md,
  },
  emptyArtWrap: {
    width: 196,
    height: 196,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  emptyGlow: {
    position: 'absolute',
    width: 176,
    height: 176,
    borderRadius: 999,
    backgroundColor: '#99F6E4',
    opacity: 0.35,
  },
  emptyCircle: {
    width: 176,
    height: 176,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: palette.panelSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyBadge: {
    position: 'absolute',
    right: 12,
    bottom: 14,
    width: 52,
    height: 52,
    borderRadius: theme.radius.lg,
    backgroundColor: '#06B6D4',
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '12deg' }],
    shadowColor: '#0891B2',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.24,
    shadowRadius: 12,
    elevation: 3,
  },
  emptyTitle: {
    color: palette.text,
    fontWeight: '900',
    fontSize: 30,
    textAlign: 'center',
  },
  emptySubtitle: {
    color: palette.textMuted,
    fontWeight: '500',
    fontSize: 17,
    lineHeight: 26,
    textAlign: 'center',
    maxWidth: 620,
  },
  emptyActionRow: {
    marginTop: theme.spacing.sm,
    flexDirection: 'row',
    gap: theme.spacing.md,
    width: '100%',
    justifyContent: 'center',
  },
  emptyActionRowStacked: {
    flexDirection: 'column',
  },
  emptyPrimaryButton: {
    minHeight: 48,
    borderRadius: theme.radius.lg,
    paddingHorizontal: 18,
    backgroundColor: palette.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#0891B2',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 3,
  },
  emptyPrimaryButtonText: {
    color: palette.text,
    fontWeight: '900',
    fontSize: 15,
  },
  emptySecondaryButton: {
    minHeight: 48,
    borderRadius: theme.radius.lg,
    paddingHorizontal: 18,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.panel,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  emptySecondaryButtonText: {
    color: palette.text,
    fontWeight: '800',
    fontSize: 15,
  },
  tournamentList: {
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
  },
});
