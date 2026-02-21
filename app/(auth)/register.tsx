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

const registerFeatures: Array<{
  icon: ComponentProps<typeof MaterialCommunityIcons>['name'];
  title: string;
}> = [
  {
    icon: 'account-group-outline',
    title: 'Manage players and brackets from one dashboard',
  },
  {
    icon: 'scoreboard-outline',
    title: 'Track match updates and share public results',
  },
  {
    icon: 'shield-check-outline',
    title: 'Secure organizer access for every event',
  },
];

export default function RegisterScreen() {
  const { user, loading, error, register } = useAuth();
  const [name, setName] = useState('');
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

  const handleRegister = async () => {
    if (!name.trim() || !email.trim() || !password.trim()) {
      Alert.alert('Missing fields', 'Enter name, email, and password.');
      return;
    }

    try {
      setSubmitting(true);
      await register(email.trim(), password, name.trim());
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
            <Text style={styles.badge}>Setup in Minutes</Text>
            <Text style={styles.heroTitle}>Create your organizer workspace.</Text>
            <Text style={styles.heroSubtitle}>
              Launch a tournament hub with cleaner setup, faster scheduling, and better visibility for teams.
            </Text>
            <Image
              source={require('../../assets/images/splash-icon.png')}
              style={styles.heroImage}
              resizeMode="cover"
            />
            <View style={styles.featureList}>
              {registerFeatures.map((item) => (
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
            <Text style={styles.title}>Create organizer account</Text>
            <Text style={styles.subtitle}>Set up your profile to start managing tournaments.</Text>
            <AppInput
              label="Full name"
              value={name}
              onChangeText={setName}
              placeholder="Enter your name"
            />
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
              placeholder="Create a password"
            />
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <AppButton
              label={submitting ? 'Creating...' : 'Create Account'}
              disabled={submitting}
              onPress={() => void handleRegister()}
              style={styles.submitButton}
            />
            <Link href="/(auth)/login" style={styles.link}>
              Already have an account? Sign in
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
    opacity: 0.32,
  },
  glowOrbTop: {
    width: 360,
    height: 360,
    right: -110,
    top: -120,
    backgroundColor: '#7DD3FC',
  },
  glowOrbBottom: {
    width: 300,
    height: 300,
    left: -130,
    bottom: -100,
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
    backgroundColor: '#082F49',
    borderRadius: theme.radius.xl,
    padding: theme.spacing.xl,
    gap: theme.spacing.md,
    borderWidth: 1,
    borderColor: '#155E75',
  },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: theme.radius.full,
    backgroundColor: '#0C4A6E',
    color: '#E0F2FE',
    fontWeight: '700',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  heroTitle: {
    color: '#F0F9FF',
    fontSize: 32,
    fontWeight: '900',
    lineHeight: 40,
  },
  heroSubtitle: {
    color: '#CFFAFE',
    fontSize: 15,
    lineHeight: 22,
  },
  heroImage: {
    width: '100%',
    height: 180,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: '#0E7490',
    backgroundColor: '#0C4A6E',
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
    backgroundColor: '#0B3A58',
    borderWidth: 1,
    borderColor: '#0E7490',
  },
  featureText: {
    color: '#E0F2FE',
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
