import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Link, router } from 'expo-router';

import { useAuth } from '@/hooks/useAuth';
import { deleteTournament, subscribeToOrganizerTournaments } from '@/lib/firestore/tournaments';
import { type TournamentDocument } from '@/lib/firestore/types';

export default function OrganizerDashboardScreen() {
  const { user, loading: authLoading, logout } = useAuth();
  const organizerUser = user && !user.isAnonymous ? user : null;
  const [tournaments, setTournaments] = useState<TournamentDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

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
        <Text style={styles.title}>Organizer Dashboard</Text>
        <Text style={styles.subtitle}>Log in to view and manage tournaments.</Text>
        <Link href="/(auth)/login" style={styles.loginLink}>
          Go to Login
        </Link>
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
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Organizer Dashboard</Text>
        <Pressable style={styles.logoutButton} onPress={() => void logout()}>
          <Text style={styles.logoutText}>Log Out</Text>
        </Pressable>
        <Link href="/(organizer)/new-tournament" style={styles.newLink}>
          + Create Tournament
        </Link>
        {deleteError ? <Text style={styles.errorText}>{deleteError}</Text> : null}

        {tournaments.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>No tournaments yet. Create one to get started.</Text>
          </View>
        ) : (
          tournaments.map((tournament) => (
            <View key={tournament.id} style={styles.card}>
              <Text style={styles.cardTitle}>{tournament.name}</Text>
              <Text style={styles.cardMeta}>
                Status: {tournament.status} | Slug: {tournament.slug}
              </Text>

              <View style={styles.actionsRow}>
                <Pressable
                  style={[styles.button, styles.buttonSecondary]}
                  onPress={() =>
                    router.push({
                      pathname: '/(organizer)/[id]/manage',
                      params: { id: tournament.id },
                    })
                  }
                >
                  <Text style={styles.buttonSecondaryText}>Manage</Text>
                </Pressable>

                <Pressable
                  style={[styles.button, styles.buttonPrimary]}
                  onPress={() =>
                    router.push({
                      pathname: '/(organizer)/[id]/results',
                      params: { id: tournament.id },
                    })
                  }
                >
                  <Text style={styles.buttonPrimaryText}>Results</Text>
                </Pressable>

                <Pressable
                  style={[
                    styles.button,
                    styles.buttonDanger,
                    deletingId === tournament.id && styles.buttonDisabled,
                  ]}
                  disabled={deletingId === tournament.id}
                  onPress={() => handleDelete(tournament)}
                >
                  <Text style={styles.buttonDangerText}>
                    {deletingId === tournament.id ? 'Deleting...' : 'Delete'}
                  </Text>
                </Pressable>
              </View>
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
    backgroundColor: '#F8FAFC',
    padding: 24,
    gap: 8,
  },
  content: {
    padding: 16,
    gap: 12,
    paddingBottom: 28,
  },
  title: {
    fontSize: 24,
    fontWeight: '900',
    color: '#0F172A',
  },
  subtitle: {
    color: '#475569',
    fontWeight: '600',
  },
  loginLink: {
    color: '#166534',
    fontWeight: '800',
  },
  newLink: {
    color: '#166534',
    fontWeight: '800',
    backgroundColor: '#DCFCE7',
    borderColor: '#86EFAC',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    overflow: 'hidden',
  },
  logoutButton: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FECACA',
    backgroundColor: '#FFF1F2',
    paddingHorizontal: 12,
    paddingVertical: 9,
    alignSelf: 'flex-start',
  },
  logoutText: {
    color: '#B91C1C',
    fontWeight: '800',
  },
  errorText: {
    color: '#B91C1C',
    fontWeight: '700',
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 8,
    padding: 10,
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E2E8F0',
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
  },
  emptyText: {
    color: '#64748B',
    fontWeight: '700',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E2E8F0',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },
  cardTitle: {
    color: '#0F172A',
    fontWeight: '900',
    fontSize: 17,
  },
  cardMeta: {
    color: '#475569',
    fontWeight: '600',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  button: {
    flex: 1,
    minHeight: 42,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonPrimary: {
    backgroundColor: '#166534',
  },
  buttonDanger: {
    backgroundColor: '#B91C1C',
  },
  buttonSecondary: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
  },
  buttonPrimaryText: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  buttonDangerText: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  buttonSecondaryText: {
    color: '#0F172A',
    fontWeight: '800',
  },
});
