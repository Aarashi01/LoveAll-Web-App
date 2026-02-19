import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';

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

        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Completed matches</Text>
          <Text style={styles.summaryValue}>{completedMatches.length}</Text>
        </View>

        <View style={styles.actionsRow}>
          <Pressable
            style={[styles.button, styles.buttonPrimary, isBusy && styles.buttonDisabled]}
            disabled={isBusy}
            onPress={() =>
              void runWithGuard('export', async () => generateResultsPDF(tournament, matches))
            }
          >
            <Text style={styles.buttonPrimaryText}>
              {activeAction === 'export' ? 'Generating...' : 'Export PDF'}
            </Text>
          </Pressable>

          <Pressable
            style={[styles.button, styles.buttonSecondary, isBusy && styles.buttonDisabled]}
            disabled={isBusy}
            onPress={() =>
              void runWithGuard('share', async () => shareResultsPDF(tournament, matches))
            }
          >
            <Text style={styles.buttonSecondaryText}>
              {activeAction === 'share' ? 'Opening...' : 'Share'}
            </Text>
          </Pressable>

          <Pressable
            style={[styles.button, styles.buttonSecondary, isBusy && styles.buttonDisabled]}
            disabled={isBusy}
            onPress={() =>
              void runWithGuard('email', async () => emailResultsPDF(tournament, matches))
            }
          >
            <Text style={styles.buttonSecondaryText}>
              {activeAction === 'email' ? 'Opening...' : 'Email'}
            </Text>
          </Pressable>
        </View>

        {lastPdfUri ? (
          <View style={styles.uriCard}>
            <Text style={styles.uriLabel}>Last generated PDF</Text>
            <Text style={styles.uriValue}>{lastPdfUri}</Text>
          </View>
        ) : null}

        <Text style={styles.sectionTitle}>Completed Match List</Text>
        {completedMatches.length === 0 ? (
          <Text style={styles.emptyText}>No completed matches yet.</Text>
        ) : (
          completedMatches.map((match) => (
            <View key={match.id} style={styles.matchCard}>
              <Text style={styles.matchTitle}>
                {match.category} - {match.round}
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
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  content: {
    padding: 16,
    gap: 12,
    paddingBottom: 32,
  },
  title: {
    fontSize: 24,
    fontWeight: '900',
    color: '#0F172A',
  },
  subTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#475569',
  },
  summaryCard: {
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
  },
  summaryLabel: {
    color: '#475569',
    fontWeight: '700',
  },
  summaryValue: {
    marginTop: 4,
    color: '#0F172A',
    fontWeight: '900',
    fontSize: 30,
  },
  actionsRow: {
    gap: 10,
  },
  button: {
    minHeight: 48,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 14,
  },
  buttonPrimary: {
    backgroundColor: '#166534',
  },
  buttonSecondary: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  buttonPrimaryText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 16,
  },
  buttonSecondaryText: {
    color: '#0F172A',
    fontWeight: '800',
    fontSize: 16,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  uriCard: {
    borderRadius: 12,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    padding: 12,
    gap: 6,
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
    color: '#0F172A',
    fontWeight: '900',
    fontSize: 18,
  },
  emptyText: {
    color: '#64748B',
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 20,
  },
  matchCard: {
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
    gap: 4,
  },
  matchTitle: {
    color: '#0F172A',
    fontWeight: '900',
  },
  matchBody: {
    color: '#334155',
    fontWeight: '700',
  },
  matchWinner: {
    color: '#166534',
    fontWeight: '800',
  },
  errorText: {
    color: '#B91C1C',
    fontWeight: '700',
    textAlign: 'center',
  },
});
