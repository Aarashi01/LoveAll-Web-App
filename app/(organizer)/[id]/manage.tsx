import { SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { Link, useLocalSearchParams } from 'expo-router';

export default function TournamentManageScreen() {
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
        <Text style={styles.title}>Tournament Manage</Text>
        <Text style={styles.meta}>Tournament ID: {id}</Text>

        <Link href={{ pathname: '/(organizer)/[id]/setup', params: { id } }} style={styles.linkCard}>
          Player Setup
        </Link>
        <Link
          href={{ pathname: '/(organizer)/[id]/schedule', params: { id } }}
          style={styles.linkCard}
        >
          Schedule
        </Link>
        <Link href={{ pathname: '/(organizer)/[id]/results', params: { id } }} style={styles.linkCard}>
          Results & Export
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
    marginBottom: 4,
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
