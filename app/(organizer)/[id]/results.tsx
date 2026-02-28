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
          <View style={styles.leftColumn}>
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

          <View style={styles.rightColumn}>
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
  backgroundLayer: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  glowOrb: {
    position: 'absolute',
    borderRadius: theme.radius.full,
    opacity: 0.15,
    ...(typeof window !== 'undefined' && {
      filter: 'blur(100px)',
    }),
  },
  glowOrbTop: {
    width: 600,
    height: 600,
    top: -200,
    right: -200,
    backgroundColor: '#3B82F6', // Deep vibrant blue
  },
  glowOrbBottom: {
    width: 500,
    height: 500,
    bottom: -150,
    left: -150,
    backgroundColor: '#10B981', // Neon emerald
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.background,
    padding: 24,
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 40,
    gap: 20,
    width: '100%',
    maxWidth: 1200,
    alignSelf: 'center',
  },
  header: {
    gap: 4,
  },
  splitLayout: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 24,
  },
  leftColumn: {
    flex: 2,
    gap: 24,
  },
  rightColumn: {
    flex: 3,
    gap: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  subTitle: {
    marginTop: -8,
    color: '#94A3B8',
    fontWeight: '600',
    fontSize: 16,
  },
  summaryLabel: {
    color: '#94A3B8',
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    fontSize: 13,
  },
  summaryValue: {
    marginTop: 8,
    color: '#F8FAFC',
    fontWeight: '900',
    fontSize: 36,
  },
  actionsRow: {
    gap: 12,
    marginTop: 8,
  },
  uriCard: {
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.3)',
  },
  uriLabel: {
    color: '#60A5FA',
    fontWeight: '800',
  },
  uriValue: {
    color: '#93C5FD',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
  },
  sectionTitle: {
    color: '#F8FAFC',
    fontWeight: '900',
    fontSize: 18,
    letterSpacing: 0.5,
  },
  emptyText: {
    color: '#94A3B8',
    fontWeight: '700',
    fontSize: 15,
    textAlign: 'center',
    padding: 24,
  },
  matchesCard: {
    flex: 1,
  },
  matchesHeader: {
    marginBottom: 8,
  },
  matchGrid: {
    gap: 16,
  },
  matchRow: {
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 14,
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
    padding: 16,
    gap: 12,
    ...(typeof window !== 'undefined' && {
      transition: 'all 0.2s ease',
    }),
  },
  matchInfo: {
    gap: 4,
  },
  matchTitle: {
    color: '#F8FAFC',
    fontWeight: '900',
    fontSize: 16,
  },
  matchBody: {
    color: '#60A5FA',
    fontWeight: '800',
    fontSize: 15,
  },
  matchWinner: {
    color: '#94A3B8',
    fontWeight: '600',
    fontSize: 14,
    marginTop: 2,
  },
  winnerText: {
    color: '#10B981',
    fontWeight: '800',
  },
  errorText: {
    color: '#EF4444',
    fontWeight: '700',
    textAlign: 'center',
  },
});

