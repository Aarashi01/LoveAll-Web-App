import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';

import { QuickMatchButton } from '@/components/quick/QuickMatchButton';
import { TournamentCard } from '@/components/tournament/TournamentCard';
import { AppButton } from '@/components/ui/AppButton';
import { theme } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { subscribeToOrganizerTournaments, subscribeToPublicTournaments } from '@/lib/firestore/tournaments';
import { type TournamentDocument } from '@/lib/firestore/types';

export default function OrganizerDashboardScreen() {
  const { user, loading: authLoading } = useAuth();
  const { width } = useWindowDimensions();
  const isCompact = width < 760;
  const heroFontSize = width >= 1100 ? 56 : width >= 720 ? 48 : 38;
  const heroLineHeight = Math.round(heroFontSize * 1.05);
  const organizerUser = user && !user.isAnonymous ? user : null;
  const [ownTournaments, setOwnTournaments] = useState<TournamentDocument[]>([]);
  const [publicTournaments, setPublicTournaments] = useState<TournamentDocument[]>([]);
  const [loadingOwn, setLoadingOwn] = useState(true);
  const [loadingPublic, setLoadingPublic] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (!organizerUser?.uid) {
      setOwnTournaments([]);
      setLoadingOwn(false);
      return;
    }
    const unsubscribe = subscribeToOrganizerTournaments(organizerUser.uid, (docs) => {
      setOwnTournaments(docs);
      setLoadingOwn(false);
    });
    return unsubscribe;
  }, [organizerUser?.uid]);

  useEffect(() => {
    const unsubscribe = subscribeToPublicTournaments((docs) => {
      setPublicTournaments(docs);
      setLoadingPublic(false);
    });
    return unsubscribe;
  }, []);

  const othersPublicTournaments = useMemo(
    () => publicTournaments.filter((t) => t.organizerId !== organizerUser?.uid),
    [publicTournaments, organizerUser?.uid],
  );

  const allTournaments = useMemo(() => {
    const map = new Map<string, TournamentDocument>();
    ownTournaments.forEach((t) => map.set(t.id, t));
    othersPublicTournaments.forEach((t) => { if (!map.has(t.id)) map.set(t.id, t); });
    return Array.from(map.values());
  }, [ownTournaments, othersPublicTournaments]);

  const stats = useMemo(() => {
    const drafts = allTournaments.filter((item) => item.status === 'draft').length;
    const active = allTournaments.filter(
      (item) => item.status === 'group_stage' || item.status === 'knockout'
    ).length;
    const completed = allTournaments.filter((item) => item.status === 'completed').length;

    return [
      { label: 'Total', value: allTournaments.length },
      { label: 'Live', value: active, accent: true },
      { label: 'Drafts', value: drafts },
      { label: 'Completed', value: completed },
    ];
  }, [allTournaments]);

  const filteredOwn = useMemo(() => {
    if (!searchQuery.trim()) return ownTournaments;
    const q = searchQuery.toLowerCase().trim();
    return ownTournaments.filter(
      (t) => t.name.toLowerCase().includes(q) || t.id.toLowerCase() === q || t.slug.toLowerCase().includes(q)
    );
  }, [ownTournaments, searchQuery]);

  const filteredOthers = useMemo(() => {
    if (!searchQuery.trim()) return othersPublicTournaments;
    const q = searchQuery.toLowerCase().trim();
    return othersPublicTournaments.filter(
      (t) => t.name.toLowerCase().includes(q) || t.id.toLowerCase() === q || t.slug.toLowerCase().includes(q)
    );
  }, [othersPublicTournaments, searchQuery]);

  const loading = loadingOwn || loadingPublic;

  if (authLoading || loading) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator size="large" color={theme.colors.text} />
      </SafeAreaView>
    );
  }

  if (!organizerUser) {
    return (
      <SafeAreaView style={styles.centered}>
        <View style={styles.authBlock}>
          <Text style={styles.eyebrow}>Sign in required</Text>
          <Text style={styles.title}>Organizer Dashboard.</Text>
          <Text style={styles.subtitle}>Sign in to view and manage your tournaments.</Text>
          <AppButton label="Go to sign in" onPress={() => router.push('/(auth)/login')} />
        </View>
      </SafeAreaView>
    );
  }

  const renderCard = (tournament: TournamentDocument) => (
    <TournamentCard
      key={tournament.id}
      tournament={tournament}
      onManage={() =>
        router.push({ pathname: '/(organizer)/[id]/manage', params: { id: tournament.id } })
      }
      onResults={() =>
        router.push({ pathname: '/(organizer)/[id]/results', params: { id: tournament.id } })
      }
      onWatchParty={() => router.push(`/(watch)/${tournament.id}?mode=id` as any)}
    />
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* HERO BLOCK — bold ink band */}
        <View style={styles.hero}>
          <Text style={styles.heroEyebrow}>Tournament Control Center</Text>
          <View style={[styles.heroRow, isCompact && styles.heroRowStacked]}>
            <Text style={[styles.heroTitle, { fontSize: heroFontSize, lineHeight: heroLineHeight }]}>RUN YOUR{'\n'}TOURNAMENTS.</Text>
            <View style={[styles.heroCta, isCompact && styles.heroCtaWide]}>
              <AppButton
                label="+ New tournament"
                onPress={() => router.push('/(organizer)/new-tournament')}
              />
              <Text style={styles.heroCtaHelper}>Create, schedule, and publish in one flow.</Text>
              <QuickMatchButton variant="inverse" style={styles.heroQuickMatch} />
            </View>
          </View>
        </View>

        {/* STATS STRIP */}
        <View style={[styles.statsRow, isCompact && styles.statsRowCompact]}>
          {stats.map((item, idx) => {
            const isFirstColumn = isCompact ? idx % 2 === 0 : idx === 0;
            return (
              <View
                key={item.label}
                style={[
                  styles.statCell,
                  isCompact && styles.statCellCompact,
                  !isFirstColumn && styles.statCellBorder,
                  isCompact && idx >= 2 && styles.statCellBorderTop,
                ]}
              >
                <Text style={[styles.statValue, item.accent && styles.statValueAccent]}>{item.value}</Text>
                <Text style={styles.statLabel}>{item.label.toUpperCase()}</Text>
              </View>
            );
          })}
        </View>

        <View style={styles.contentInner}>
          {(ownTournaments.length > 0 || othersPublicTournaments.length > 0) && (
            <View style={styles.searchRow}>
              <Text style={styles.searchIcon}>⌕</Text>
              <TextInput
                style={styles.searchInput}
                placeholder="Search tournaments by name, ID, or slug"
                placeholderTextColor={theme.colors.textSubtle}
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoCorrect={false}
                autoCapitalize="none"
                returnKeyType="search"
              />
              {searchQuery ? (
                <Pressable onPress={() => setSearchQuery('')} style={styles.clearBtn} hitSlop={8}>
                  <Text style={styles.clearText}>Clear</Text>
                </Pressable>
              ) : null}
            </View>
          )}

          {/* Your Tournaments */}
          <View style={styles.sectionHead}>
            <Text style={styles.sectionTitle}>Your tournaments</Text>
            <Text style={styles.sectionMeta}>
              {ownTournaments.length === 0
                ? 'No tournaments created yet'
                : `${filteredOwn.length} result${filteredOwn.length === 1 ? '' : 's'}`}
            </Text>
          </View>

          {ownTournaments.length === 0 ? (
            <View style={styles.emptyBlock}>
              <Text style={styles.emptyTitle}>NO TOURNAMENTS YET.</Text>
              <Text style={styles.emptyText}>
                Start by creating your first tournament to unlock scheduling and live results.
              </Text>
              <AppButton
                label="Create your first tournament"
                onPress={() => router.push('/(organizer)/new-tournament')}
              />
            </View>
          ) : filteredOwn.length === 0 ? (
            <View style={styles.emptyBlock}>
              <Text style={styles.emptyText}>No matching tournaments found in your list.</Text>
            </View>
          ) : (
            <View style={styles.cardList}>
              {filteredOwn.map(renderCard)}
            </View>
          )}

          {/* Public from others */}
          {othersPublicTournaments.length > 0 && (
            <>
              <View style={[styles.sectionHead, styles.sectionHeadSpaced]}>
                <Text style={styles.sectionTitle}>Public tournaments</Text>
                <Text style={styles.sectionMeta}>
                  {filteredOthers.length} from other organizers
                </Text>
              </View>
              {filteredOthers.length === 0 ? (
                <View style={styles.emptyBlock}>
                  <Text style={styles.emptyText}>No matching public tournaments found.</Text>
                </View>
              ) : (
                <View style={styles.cardList}>
                  {filteredOthers.map(renderCard)}
                </View>
              )}
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.background,
    padding: theme.spacing.xl,
  },
  scrollContent: {
    paddingBottom: 64,
  },
  authBlock: {
    width: '100%',
    maxWidth: 420,
    gap: theme.spacing.md,
  },
  hero: {
    backgroundColor: theme.colors.surfaceInverse,
    paddingHorizontal: theme.spacing.xl,
    paddingTop: 56,
    paddingBottom: 56,
    gap: theme.spacing.xl,
  },
  heroEyebrow: {
    color: theme.colors.textInverse,
    opacity: 0.6,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: theme.spacing.xl,
  },
  heroRowStacked: {
    flexDirection: 'column',
    alignItems: 'flex-start',
  },
  heroTitle: {
    color: theme.colors.textInverse,
    fontWeight: '900',
    letterSpacing: -2,
    flex: 1,
  },
  heroCta: {
    minWidth: 280,
    gap: 8,
    alignItems: 'flex-start',
  },
  heroCtaWide: {
    width: '100%',
  },
  heroCtaHelper: {
    color: theme.colors.textInverse,
    opacity: 0.6,
    fontSize: 12,
    fontWeight: '500',
  },
  heroQuickMatch: {
    marginTop: theme.spacing.md,
    width: '100%',
  },
  statsRow: {
    flexDirection: 'row',
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  statsRowCompact: {
    flexWrap: 'wrap',
  },
  statCell: {
    flex: 1,
    paddingVertical: theme.spacing.xl,
    paddingHorizontal: theme.spacing.lg,
    gap: 4,
  },
  statCellCompact: {
    flexBasis: '50%',
    flexGrow: 1,
    flexShrink: 0,
    minWidth: 0,
  },
  statCellBorder: {
    borderLeftWidth: 1,
    borderLeftColor: theme.colors.border,
  },
  statCellBorderTop: {
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  statValue: {
    color: theme.colors.text,
    fontSize: 36,
    fontWeight: '900',
    letterSpacing: -1,
  },
  statValueAccent: {
    color: theme.colors.accent,
  },
  statLabel: {
    color: theme.colors.textMuted,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.4,
  },
  contentInner: {
    paddingHorizontal: theme.spacing.xl,
    paddingTop: theme.spacing.xl,
    gap: theme.spacing.lg,
    maxWidth: 1200,
    width: '100%',
    alignSelf: 'center',
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    paddingHorizontal: 14,
    height: 52,
    gap: 10,
  },
  searchIcon: {
    fontSize: 18,
    fontWeight: '900',
    color: theme.colors.text,
  },
  searchInput: {
    flex: 1,
    color: theme.colors.text,
    fontSize: 15,
    fontWeight: '500',
    height: '100%',
    ...(typeof window !== 'undefined' && ({ outlineStyle: 'none' } as any)),
  },
  clearBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  clearText: {
    color: theme.colors.text,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.6,
    textDecorationLine: 'underline',
  },
  sectionHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: 8,
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.xs,
  },
  sectionHeadSpaced: {
    marginTop: theme.spacing.xxl,
  },
  sectionTitle: {
    color: theme.colors.text,
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.4,
  },
  sectionMeta: {
    color: theme.colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  cardList: {
    // cards have their own borders; stack flush
  },
  emptyBlock: {
    paddingVertical: theme.spacing.xxl,
    paddingHorizontal: theme.spacing.lg,
    backgroundColor: theme.colors.surfaceSoft,
    gap: theme.spacing.md,
    alignItems: 'flex-start',
  },
  emptyTitle: {
    color: theme.colors.text,
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  emptyText: {
    color: theme.colors.textMuted,
    fontWeight: '500',
    lineHeight: 22,
    fontSize: 15,
  },
  eyebrow: {
    color: theme.colors.textMuted,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
  title: {
    color: theme.colors.text,
    fontSize: 36,
    fontWeight: '900',
    letterSpacing: -1,
  },
  subtitle: {
    color: theme.colors.textMuted,
    fontWeight: '500',
    lineHeight: 22,
    fontSize: 15,
  },
});
