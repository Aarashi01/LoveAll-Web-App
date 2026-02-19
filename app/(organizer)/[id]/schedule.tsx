import { SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { Link, useLocalSearchParams } from 'expo-router';

export default function TournamentScheduleScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  if (!id) {
    return (
      <SafeAreaView style={styles.centered}>
        <Text style={styles.errorText}>Missing tournament id.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.content}>
        <Text style={styles.title}>Tournament Schedule</Text>
        <Text style={styles.meta}>Tournament ID: {id}</Text>

        <Text style={styles.note}>
          Schedule generation UI (group fixtures + knockout bracket writes) will be connected here next.
        </Text>

        <Link href={{ pathname: '/(organizer)/[id]/manage', params: { id } }} style={styles.linkCard}>
          Back to Manage
        </Link>
      </View>
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
    backgroundColor: '#F8FAFC',
  },
  errorText: {
    color: '#B91C1C',
    fontWeight: '700',
  },
  content: {
    padding: 16,
    gap: 10,
  },
  title: {
    fontSize: 24,
    fontWeight: '900',
    color: '#0F172A',
  },
  meta: {
    color: '#475569',
    fontWeight: '600',
  },
  note: {
    color: '#334155',
    fontWeight: '600',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    padding: 12,
  },
  linkCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    color: '#0F172A',
    fontWeight: '800',
    overflow: 'hidden',
  },
});
