import { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';

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

  const completedMatches = useMemo(
    () => matches.filter((match) => match.status === 'completed'),
    [matches],
  );

  const isLoading = tournamentLoading || matchesLoading;
  const isBusy = activeAction !== null;

  const runWithGuard = async (action: Exclude<ExportAction, null>, task: () => Promise<string>) => {
    if (!tournament) return;
    if (completedMatches.length === 0) {
      Alert.alert('No completed matches', 'Complete at least one match before exporting results.');
      return;
    }

    try {
      setActiveAction(action);
      const uri = await task();
      setLastPdfUri(uri);
      if (action === 'export') {
        Alert.alert('PDF generated', `Saved to:\n${uri}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Action failed';
      Alert.alert('Export failed', message);
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
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Results Export</Text>
        <Text style={styles.subTitle}>{tournament.name}</Text>

        <AppCard>
          <Text style={styles.summaryLabel}>Completed matches</Text>
          <Text style={styles.summaryValue}>{completedMatches.length}</Text>
        </AppCard>

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

        {lastPdfUri ? (
          <AppCard style={styles.uriCard}>
            <Text style={styles.uriLabel}>Last generated PDF</Text>
            <Text style={styles.uriValue}>{lastPdfUri}</Text>
          </AppCard>
        ) : null}

        <Text style={styles.sectionTitle}>Completed Match List</Text>
        {completedMatches.length === 0 ? (
          <Text style={styles.emptyText}>No completed matches yet.</Text>
        ) : (
          completedMatches.map((match) => (
            <AppCard key={match.id}>
              <Text style={styles.matchTitle}>
                {toCategoryLabel(match.category)} - {toRoundLabel(match.round)}
              </Text>
              <Text style={styles.matchBody}>
                {match.player1Name} vs {match.player2Name}
              </Text>
              <Text style={styles.matchWinner}>
                Winner:{' '}
                {match.winnerId === match.player1Id
                  ? match.player1Name
                  : match.winnerId === match.player2Id
                    ? match.player2Name
                    : 'TBD'}
              </Text>
            </AppCard>
          ))
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
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: theme.colors.background,
  },
  content: {
    padding: 16,
    gap: 12,
    paddingBottom: 32,
  },
  title: {
    fontSize: 24,
    fontWeight: '900',
    color: theme.colors.text,
  },
  subTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.colors.textMuted,
  },
  summaryLabel: {
    color: theme.colors.textMuted,
    fontWeight: '700',
  },
  summaryValue: {
    marginTop: 4,
    color: theme.colors.text,
    fontWeight: '900',
    fontSize: 30,
  },
  actionsRow: {
    gap: 10,
  },
  uriCard: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  uriLabel: {
    color: '#1E3A8A',
    fontWeight: '800',
  },
  uriValue: {
    color: '#1E40AF',
    fontSize: 12,
    lineHeight: 18,
  },
  sectionTitle: {
    marginTop: 4,
    color: theme.colors.text,
    fontWeight: '900',
    fontSize: 18,
  },
  emptyText: {
    color: theme.colors.textMuted,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 20,
  },
  matchTitle: {
    color: theme.colors.text,
    fontWeight: '900',
  },
  matchBody: {
    color: '#334155',
    fontWeight: '700',
  },
  matchWinner: {
    color: theme.colors.success,
    fontWeight: '800',
  },
  errorText: {
    color: theme.colors.danger,
    fontWeight: '700',
    textAlign: 'center',
  },
});

