import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Link, router } from 'expo-router';
import type { ComponentProps } from 'react';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions
} from 'react-native';

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
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const { width } = useWindowDimensions();
  const isWide = width >= 980;

  useEffect(() => {
    if (user && !user.isAnonymous && !loading) {
      router.replace('/(organizer)/dashboard');
    }
  }, [loading, user]);

  const handleLogin = async () => {
    setFormError(null);
    if (!email.trim() || !password.trim()) {
      setFormError('Please enter both email and password.');
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
            {error || formError ? <Text style={styles.error}>{error || formError}</Text> : null}
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
    width: 600,
    height: 600,
    right: -200,
    top: -200,
    backgroundColor: '#3B82F6', // Vibrant blue
    filter: 'blur(120px)',
    opacity: 0.15,
  },
  glowOrbBottom: {
    width: 500,
    height: 500,
    left: -150,
    bottom: -150,
    backgroundColor: '#10B981', // Emerald green
    filter: 'blur(100px)',
    opacity: 0.15,
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
    backgroundColor: 'transparent',
    borderRadius: theme.radius.xl,
    padding: theme.spacing.xl,
    gap: theme.spacing.xl,
    justifyContent: 'center',
  },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: theme.radius.full,
    backgroundColor: 'rgba(59, 130, 246, 0.15)', // Accent tint
    color: '#60A5FA', // Bright blue
    fontWeight: '800',
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.3)',
  },
  heroTitle: {
    color: '#FFFFFF',
    fontSize: 42,
    fontWeight: '900',
    lineHeight: 52,
    letterSpacing: -1,
  },
  heroSubtitle: {
    color: '#94A3B8',
    fontSize: 18,
    lineHeight: 28,
    fontWeight: '400',
  },
  heroImage: {
    width: '100%',
    height: 200,
    borderRadius: theme.radius.xl,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    backgroundColor: '#0F172A',
    opacity: 0.8,
  },
  featureList: {
    gap: theme.spacing.md,
    marginTop: 10,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  featureIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.15)', // Neon green tint
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  featureText: {
    color: '#E2E8F0',
    fontWeight: '500',
    fontSize: 15,
    flexShrink: 1,
  },
  formCard: {
    flex: 1,
    minWidth: 320,
    maxWidth: 460,
    alignSelf: 'center',
    width: '100%',
    gap: theme.spacing.xl,
    paddingHorizontal: 32,
    paddingVertical: 40,
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
