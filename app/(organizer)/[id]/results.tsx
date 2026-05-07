import { useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
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

import { AppButton } from '@/components/ui/AppButton';
import { AppCard } from '@/components/ui/AppCard';
import { theme, toCategoryLabel, toRoundLabel } from '@/constants/theme';
import { useMatches } from '@/hooks/useMatches';
import { useTournament } from '@/hooks/useTournament';
import { emailResultsPDF, generateResultsPDF, shareResultsPDF } from '@/lib/pdf-generator';

type ExportAction = 'export' | 'share' | 'email' | null;

export default function ResultsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { tournament, loading: tournamentLoading, error: tournamentError } = useTournament(id);
  const { matches, loading: matchesLoading, error: matchesError } = useMatches(id);

  const [activeAction, setActiveAction] = useState<ExportAction>(null);
  const [lastPdfUri, setLastPdfUri] = useState<string | null>(null);

  const { width } = useWindowDimensions();
  const isWide = width >= 1024;

  const completedMatches = useMemo(
    () => matches.filter((match) => match.status === 'completed'),
    [matches],
  );

  const isLoading = tournamentLoading || matchesLoading;
  const isBusy = activeAction !== null;

  const runWithGuard = async (action: Exclude<ExportAction, null>, task: () => Promise<string>) => {
    if (!tournament) return;
    if (completedMatches.length === 0) {
      if (Platform.OS === 'web') {
        globalThis.alert('Complete at least one match before exporting results.');
      } else {
        Alert.alert('No completed matches', 'Complete at least one match before exporting results.');
      }
      return;
    }

    try {
      setActiveAction(action);
      const uri = await task();
      setLastPdfUri(uri);
      if (action === 'export') {
        if (Platform.OS === 'web') {
          globalThis.alert(`PDF generated! Saved to:\n${uri}`);
        } else {
          Alert.alert('PDF generated', `Saved to:\n${uri}`);
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Action failed';
      if (Platform.OS === 'web') {
        globalThis.alert(`Export failed: ${message}`);
      } else {
        Alert.alert('Export failed', message);
      }
    } finally {
      setActiveAction(null);
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator size="large" />
      </SafeAreaView>
    );
  }

  if (!tournament) {
    return (
      <SafeAreaView style={styles.centered}>
        <Text style={styles.errorText}>
          {tournamentError ?? matchesError ?? 'Tournament not found.'}
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View pointerEvents="none" style={styles.backgroundLayer}>
        <View style={[styles.glowOrb, styles.glowOrbTop]} />
        <View style={[styles.glowOrb, styles.glowOrbBottom]} />
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>Results Export</Text>
          <Text style={styles.subTitle}>{tournament.name}</Text>
        </View>

        <View style={isWide ? styles.splitLayout : undefined}>
          <View style={[styles.leftColumn, isWide && { flex: 2 }]}>
            <AppCard>
              <Text style={styles.summaryLabel}>Completed matches</Text>
              <Text style={styles.summaryValue}>{completedMatches.length}</Text>
            </AppCard>

            <AppCard>
              <Text style={styles.sectionTitle}>Export Options</Text>
              <View style={styles.actionsRow}>
                <AppButton
                  label={activeAction === 'export' ? 'Generating...' : 'Export PDF'}
                  disabled={isBusy}
                  onPress={() =>
                    void runWithGuard('export', async () => generateResultsPDF(tournament, matches))
                  }
                />
                <AppButton
                  variant="secondary"
                  label={activeAction === 'share' ? 'Opening...' : 'Share'}
                  disabled={isBusy}
                  onPress={() =>
                    void runWithGuard('share', async () => shareResultsPDF(tournament, matches))
                  }
                />
                <AppButton
                  variant="secondary"
                  label={activeAction === 'email' ? 'Opening...' : 'Email'}
                  disabled={isBusy}
                  onPress={() =>
                    void runWithGuard('email', async () => emailResultsPDF(tournament, matches))
                  }
                />
              </View>
            </AppCard>

            {lastPdfUri ? (
              <AppCard style={styles.uriCard}>
                <Text style={styles.uriLabel}>Last generated PDF</Text>
                <Text style={styles.uriValue}>{lastPdfUri}</Text>
              </AppCard>
            ) : null}
          </View>

          <View style={[styles.rightColumn, isWide && { flex: 3 }]}>
            <AppCard style={styles.matchesCard}>
              <View style={styles.matchesHeader}>
                <Text style={styles.sectionTitle}>Completed Match List</Text>
              </View>
              {completedMatches.length === 0 ? (
                <Text style={styles.emptyText}>No completed matches yet.</Text>
              ) : (
                <View style={styles.matchGrid}>
                  {completedMatches.map((match) => (
                    <View key={match.id} style={styles.matchRow}>
                      <View style={styles.matchInfo}>
                        <Text style={styles.matchTitle}>
                          {toCategoryLabel(match.category)} - {toRoundLabel(match.round)}
                        </Text>
                        <Text style={styles.matchBody}>
                          {match.player1Name} vs {match.player2Name}
                        </Text>
                        <Text style={styles.matchWinner}>
                          Winner:{' '}
                          <Text style={styles.winnerText}>
                            {match.winnerId === match.player1Id
                              ? match.player1Name
                              : match.winnerId === match.player2Id
                                ? match.player2Name
                                : 'TBD'}
                          </Text>
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </AppCard>
          </View>
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
  backgroundLayer: { display: 'none' },
  glowOrb: { display: 'none' },
  glowOrbTop: { display: 'none' },
  glowOrbBottom: { display: 'none' },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.background,
    padding: theme.spacing.xl,
  },
  content: {
    paddingHorizontal: theme.spacing.xl,
    paddingTop: theme.spacing.xl,
    paddingBottom: 48,
    gap: theme.spacing.lg,
    width: '100%',
    maxWidth: 1200,
    alignSelf: 'center',
  },
  header: {
    gap: 4,
    marginBottom: 4,
  },
  splitLayout: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: theme.spacing.xl,
  },
  leftColumn: { gap: theme.spacing.lg },
  rightColumn: { gap: theme.spacing.lg },
  title: {
    fontSize: 36,
    fontWeight: '900',
    color: theme.colors.text,
    letterSpacing: -1,
  },
  subTitle: {
    marginTop: -4,
    color: theme.colors.textMuted,
    fontWeight: '500',
    fontSize: 14,
  },
  summaryLabel: {
    color: theme.colors.text,
    fontWeight: '900',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    fontSize: 11,
  },
  summaryValue: {
    marginTop: 4,
    color: theme.colors.text,
    fontWeight: '900',
    fontSize: 40,
    letterSpacing: -1,
  },
  actionsRow: {
    gap: 8,
    marginTop: theme.spacing.md,
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  uriCard: {
    backgroundColor: theme.colors.surfaceSoft,
    borderLeftWidth: 3,
    borderLeftColor: theme.colors.text,
  },
  uriLabel: {
    color: theme.colors.text,
    fontWeight: '800',
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  uriValue: {
    color: theme.colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
  },
  sectionTitle: {
    color: theme.colors.text,
    fontWeight: '900',
    fontSize: 18,
    letterSpacing: -0.2,
  },
  emptyText: {
    color: theme.colors.textMuted,
    fontWeight: '600',
    fontSize: 14,
    padding: theme.spacing.lg,
  },
  matchesCard: { flex: 1 },
  matchesHeader: { marginBottom: 4 },
  matchGrid: { },
  matchRow: {
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: 4,
    gap: 6,
  },
  matchInfo: { gap: 4 },
  matchTitle: {
    color: theme.colors.text,
    fontWeight: '900',
    fontSize: 15,
  },
  matchBody: {
    color: theme.colors.text,
    fontWeight: '700',
    fontSize: 14,
    fontVariant: ['tabular-nums'],
  },
  matchWinner: {
    color: theme.colors.textMuted,
    fontWeight: '500',
    fontSize: 13,
    marginTop: 2,
  },
  winnerText: {
    color: theme.colors.text,
    fontWeight: '900',
  },
  errorText: {
    color: theme.colors.danger,
    fontWeight: '700',
  },
});

