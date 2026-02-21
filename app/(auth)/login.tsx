import { useEffect, useState } from 'react';
import type { ComponentProps } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { Link, router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { AppButton } from '@/components/ui/AppButton';
import { AppCard } from '@/components/ui/AppCard';
import { AppInput } from '@/components/ui/AppInput';
import { theme } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';

const loginFeatures: Array<{
  icon: ComponentProps<typeof MaterialCommunityIcons>['name'];
  title: string;
}> = [
  {
    icon: 'trophy-outline',
    title: 'Brackets without spreadsheet pain',
  },
  {
    icon: 'calendar-clock',
    title: 'Scheduling and results in one flow',
  },
  {
    icon: 'chart-box-outline',
    title: 'Cleaner organizer control panel',
  },
];

export default function LoginScreen() {
  const { user, loading, error, login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { width } = useWindowDimensions();
  const isWide = width >= 980;

  useEffect(() => {
    if (user && !user.isAnonymous && !loading) {
      router.replace('/(organizer)/dashboard');
    }
  }, [loading, user]);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Missing fields', 'Enter both email and password.');
      return;
    }

    try {
      setSubmitting(true);
      await login(email.trim(), password);
      router.replace('/(organizer)/dashboard');
    } catch {
      // Error is shown from hook state.
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator size="large" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View pointerEvents="none" style={styles.backgroundLayer}>
        <View style={[styles.glowOrb, styles.glowOrbTop]} />
        <View style={[styles.glowOrb, styles.glowOrbBottom]} />
      </View>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={[styles.shell, isWide && styles.shellWide]}>
          <View style={styles.heroPane}>
            <Text style={styles.badge}>LoveAll Organizer</Text>
            <Text style={styles.heroTitle}>Run every tournament with less chaos.</Text>
            <Text style={styles.heroSubtitle}>
              Keep brackets, results, and match flow in one clean workspace built for fast decisions.
            </Text>
            <Image
              source={require('../../assets/images/splash-icon.png')}
              style={styles.heroImage}
              resizeMode="cover"
            />
            <View style={styles.featureList}>
              {loginFeatures.map((item) => (
                <View key={item.title} style={styles.featureRow}>
                  <View style={styles.featureIconWrap}>
                    <MaterialCommunityIcons
                      name={item.icon}
                      size={16}
                      color={theme.colors.accent}
                    />
                  </View>
                  <Text style={styles.featureText}>{item.title}</Text>
                </View>
              ))}
            </View>
          </View>

          <AppCard style={styles.formCard}>
            <Text style={styles.title}>Welcome back</Text>
            <Text style={styles.subtitle}>Sign in to access your tournament workspace.</Text>
            <AppInput
              label="Email address"
              autoCapitalize="none"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
            />
            <AppInput
              label="Password"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
              placeholder="Enter your password"
            />
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <AppButton
              label={submitting ? 'Signing In...' : 'Sign In'}
              disabled={submitting}
              onPress={() => void handleLogin()}
              style={styles.submitButton}
            />
            <Link href="/(auth)/register" style={styles.link}>
              Need an account? Create one
            </Link>
          </AppCard>
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
    opacity: 0.35,
  },
  glowOrbTop: {
    width: 320,
    height: 320,
    right: -90,
    top: -80,
    backgroundColor: '#93C5FD',
  },
  glowOrbBottom: {
    width: 280,
    height: 280,
    left: -120,
    bottom: -110,
    backgroundColor: '#99F6E4',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.xl,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.background,
  },
  shell: {
    width: '100%',
    maxWidth: 1120,
    alignSelf: 'center',
    gap: theme.spacing.lg,
  },
  shellWide: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  heroPane: {
    flex: 1,
    backgroundColor: '#0F172A',
    borderRadius: theme.radius.xl,
    padding: theme.spacing.xl,
    gap: theme.spacing.md,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: theme.radius.full,
    backgroundColor: '#1E293B',
    color: '#BFDBFE',
    fontWeight: '700',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  heroTitle: {
    color: '#F8FAFC',
    fontSize: 32,
    fontWeight: '900',
    lineHeight: 40,
  },
  heroSubtitle: {
    color: '#CBD5E1',
    fontSize: 15,
    lineHeight: 22,
  },
  heroImage: {
    width: '100%',
    height: 180,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: '#020617',
  },
  featureList: {
    gap: theme.spacing.sm,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  featureIconWrap: {
    width: 28,
    height: 28,
    borderRadius: theme.radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0B1326',
    borderWidth: 1,
    borderColor: '#334155',
  },
  featureText: {
    color: '#E2E8F0',
    fontWeight: '600',
    flexShrink: 1,
  },
  formCard: {
    flex: 1,
    minWidth: 320,
    maxWidth: 460,
    alignSelf: 'center',
    width: '100%',
    gap: theme.spacing.md,
  },
  title: {
    fontSize: 30,
    fontWeight: '900',
    color: theme.colors.text,
  },
  subtitle: {
    color: theme.colors.textMuted,
    fontWeight: '600',
    lineHeight: 21,
  },
  submitButton: {
    marginTop: 2,
  },
  link: {
    color: theme.colors.accent,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 4,
  },
  error: {
    color: theme.colors.danger,
    fontWeight: '700',
    backgroundColor: theme.colors.dangerSoft,
    borderColor: '#FDA4AF',
    borderWidth: 1,
    borderRadius: theme.radius.md,
    padding: theme.spacing.sm,
  },
});
