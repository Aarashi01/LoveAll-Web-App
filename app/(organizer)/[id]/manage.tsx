import { SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';

import { AppButton } from '@/components/ui/AppButton';
import { AppCard } from '@/components/ui/AppCard';
import { theme } from '@/constants/theme';

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

        <AppCard>
          <Text style={styles.sectionLabel}>Operations</Text>
          <AppButton
            variant="secondary"
            label="Player Setup"
            onPress={() => router.push({ pathname: '/(organizer)/[id]/setup', params: { id } })}
          />
          <AppButton
            variant="secondary"
            label="Schedule"
            onPress={() => router.push({ pathname: '/(organizer)/[id]/schedule', params: { id } })}
          />
          <AppButton
            label="Results & Export"
            onPress={() => router.push({ pathname: '/(organizer)/[id]/results', params: { id } })}
          />
        </AppCard>
      </View>
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
  errorText: {
    color: theme.colors.danger,
    fontWeight: '700',
  },
  content: {
    padding: 16,
    gap: 10,
  },
  title: {
    fontSize: 24,
    fontWeight: '900',
    color: theme.colors.text,
  },
  meta: {
    color: theme.colors.textMuted,
    fontWeight: '600',
    marginBottom: 4,
  },
  sectionLabel: {
    color: theme.colors.textMuted,
    fontWeight: '900',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    fontSize: 12,
  },
});

