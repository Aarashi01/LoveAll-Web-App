import { router, useLocalSearchParams } from 'expo-router';
import { Platform, SafeAreaView, StyleSheet, Text, View } from 'react-native';

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
      <View pointerEvents="none" style={styles.backgroundLayer}>
        <View style={[styles.glowOrb, styles.glowOrbTop]} />
        <View style={[styles.glowOrb, styles.glowOrbBottom]} />
      </View>
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>Tournament Dashboard</Text>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>ID: {id}</Text>
          </View>
        </View>

        <AppCard style={styles.card}>
          <Text style={styles.sectionLabel}>Operations Overview</Text>
          <View style={styles.grid}>
            <View style={styles.actionItem}>
              <Text style={styles.actionTitle}>1. Players</Text>
              <Text style={styles.actionDesc}>Add teams, review signups, set seeds.</Text>
              <AppButton
                variant="primary"
                label="Manage Players"
                onPress={() => router.push({ pathname: '/(organizer)/[id]/setup', params: { id } })}
                style={styles.actionButton}
              />
            </View>

            <View style={styles.actionItem}>
              <Text style={styles.actionTitle}>2. Schedule</Text>
              <Text style={styles.actionDesc}>Review draws and generated courts.</Text>
              <AppButton
                variant="primary"
                label="Match Schedule"
                onPress={() => router.push({ pathname: '/(organizer)/[id]/schedule', params: { id } })}
                style={styles.actionButton}
              />
            </View>

            <View style={styles.actionItem}>
              <Text style={styles.actionTitle}>3. Results</Text>
              <Text style={styles.actionDesc}>Log scores and finalize matches.</Text>
              <AppButton
                label="Live Results & Export"
                onPress={() => router.push({ pathname: '/(organizer)/[id]/results', params: { id } })}
                style={styles.actionButton}
              />
            </View>
          </View>
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
    width: 400,
    height: 400,
    bottom: -100,
    left: -150,
    backgroundColor: '#10B981', // Neon emerald
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
    padding: 24,
    gap: 24,
    width: '100%',
    maxWidth: 960,
    alignSelf: 'center',
  },
  header: {
    gap: 8,
  },
  title: {
    fontSize: 36,
    fontWeight: '900',
    color: theme.colors.text,
    letterSpacing: -0.5,
  },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: theme.radius.full,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.3)',
  },
  badgeText: {
    color: '#60A5FA',
    fontWeight: '800',
    fontSize: 12,
    letterSpacing: 1,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  card: {
    padding: 32,
    gap: 24,
  },
  sectionLabel: {
    color: '#94A3B8',
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    fontSize: 13,
  },
  grid: {
    gap: 24,
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  actionItem: {
    flex: 1,
    minWidth: 260,
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 16,
    padding: 20,
    gap: 8,
  },
  actionTitle: {
    color: '#F8FAFC',
    fontSize: 20,
    fontWeight: '800',
  },
  actionDesc: {
    color: '#94A3B8',
    fontSize: 14,
    lineHeight: 20,
    flex: 1,
  },
  actionButton: {
    marginTop: 12,
  },
});
