import { Link, router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';

import { AppButton } from '@/components/ui/AppButton';
import { AppInput } from '@/components/ui/AppInput';
import { theme } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';

const principles = [
  'Manage players and brackets in one workspace.',
  'Track match updates and share public results.',
  'Secure organizer access for every event.',
];

export default function RegisterScreen() {
  const { user, loading, error, register } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{ name?: string; email?: string; password?: string }>({});
  const [submitting, setSubmitting] = useState(false);
  const { width } = useWindowDimensions();
  const isWide = width >= 980;
  const heroFontSize = width >= 1100 ? 56 : width >= 720 ? 44 : 38;
  const heroLineHeight = Math.round(heroFontSize * 1.05);

  useEffect(() => {
    if (user && !user.isAnonymous && !loading) {
      router.replace('/(organizer)/dashboard');
    }
  }, [loading, user]);

  const handleRegister = async () => {
    const nextFieldErrors: { name?: string; email?: string; password?: string } = {};
    if (!name.trim()) nextFieldErrors.name = 'Name is required.';
    if (!email.trim()) nextFieldErrors.email = 'Email is required.';
    if (!password.trim()) nextFieldErrors.password = 'Password is required.';
    if (Object.keys(nextFieldErrors).length > 0) {
      setFieldErrors(nextFieldErrors);
      return;
    }
    setFieldErrors({});

    try {
      setSubmitting(true);
      await register(email.trim(), password, name.trim());
      router.replace('/(organizer)/dashboard');
    } catch {
      // error from hook
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator size="large" color={theme.colors.text} />
      </SafeAreaView>
    );
  }

  const heroSection = (
    <View style={[styles.hero, isWide && styles.heroWide]}>
      <Text style={styles.eyebrow}>LoveAll · New organizer</Text>
      <Text style={[styles.heroTitle, { fontSize: heroFontSize, lineHeight: heroLineHeight }]}>
        BUILD YOUR{'\n'}WORKSPACE.
      </Text>
      <Text style={styles.heroLead}>
        Launch a tournament hub with cleaner setup, faster scheduling, and better visibility for teams.
      </Text>
      <View style={styles.principles}>
        {principles.map((line, idx) => (
          <View key={line} style={styles.principleRow}>
            <Text style={styles.principleNum}>{String(idx + 1).padStart(2, '0')}</Text>
            <Text style={styles.principleText}>{line}</Text>
          </View>
        ))}
      </View>
    </View>
  );

  const formSection = (
    <View style={styles.formPane}>
      <View style={styles.formInner}>
        <Text style={styles.formEyebrow}>Member · Sign up</Text>
        <Text style={styles.formTitle}>Create your account.</Text>
        <Text style={styles.formSub}>Set up your profile to start managing tournaments.</Text>

        <View style={styles.fields}>
          <AppInput
            label="Full name"
            value={name}
            onChangeText={(text) => {
              setName(text);
              if (fieldErrors.name) setFieldErrors((prev) => ({ ...prev, name: undefined }));
            }}
            placeholder="Enter your name"
            errorText={fieldErrors.name}
          />
          <AppInput
            label="Email"
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={(text) => {
              setEmail(text);
              if (fieldErrors.email) setFieldErrors((prev) => ({ ...prev, email: undefined }));
            }}
            placeholder="you@example.com"
            errorText={fieldErrors.email}
          />
          <AppInput
            label="Password"
            secureTextEntry
            value={password}
            onChangeText={(text) => {
              setPassword(text);
              if (fieldErrors.password) setFieldErrors((prev) => ({ ...prev, password: undefined }));
            }}
            placeholder="Create a password"
            errorText={fieldErrors.password}
          />
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <AppButton
          label={submitting ? 'Creating…' : 'Create account'}
          disabled={submitting}
          onPress={() => void handleRegister()}
        />

        <Link href="/(auth)/login" style={styles.link}>
          Already a member? Sign in
        </Link>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={[styles.shell, isWide && styles.shellWide]}>
          {isWide ? (
            <>
              {heroSection}
              {formSection}
            </>
          ) : (
            <>
              {formSection}
              {heroSection}
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: theme.colors.background },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.background,
  },
  scrollContent: { flexGrow: 1 },
  shell: { flex: 1, minHeight: '100%' as any },
  shellWide: { flexDirection: 'row' },
  hero: {
    backgroundColor: theme.colors.surfaceInverse,
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing.xxxl,
    gap: theme.spacing.xl,
  },
  heroWide: {
    flex: 1.1,
    paddingHorizontal: 56,
    paddingVertical: 64,
    justifyContent: 'center',
  },
  eyebrow: {
    color: theme.colors.textInverse,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 2,
    textTransform: 'uppercase',
    opacity: 0.7,
  },
  heroTitle: {
    color: theme.colors.textInverse,
    fontWeight: '900',
    letterSpacing: -2,
  },
  heroLead: {
    color: theme.colors.textInverse,
    opacity: 0.7,
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '500',
    maxWidth: 460,
  },
  principles: { marginTop: theme.spacing.lg, gap: theme.spacing.md },
  principleRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 14,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.15)',
    paddingTop: 12,
  },
  principleNum: {
    color: theme.colors.textInverse,
    opacity: 0.5,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
    width: 28,
  },
  principleText: {
    flex: 1,
    color: theme.colors.textInverse,
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 22,
  },
  formPane: {
    flex: 1,
    backgroundColor: theme.colors.background,
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing.xxxl,
    justifyContent: 'center',
  },
  formInner: {
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
    gap: theme.spacing.md,
  },
  formEyebrow: {
    color: theme.colors.textMuted,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
  formTitle: {
    color: theme.colors.text,
    fontSize: 36,
    fontWeight: '900',
    letterSpacing: -1,
    lineHeight: 40,
  },
  formSub: {
    color: theme.colors.textMuted,
    fontSize: 15,
    fontWeight: '500',
    lineHeight: 22,
  },
  fields: { gap: theme.spacing.md, marginTop: theme.spacing.sm },
  link: {
    color: theme.colors.text,
    fontWeight: '700',
    textAlign: 'center',
    fontSize: 14,
    marginTop: 4,
    textDecorationLine: 'underline',
  },
  error: {
    color: theme.colors.danger,
    fontWeight: '700',
    fontSize: 13,
    backgroundColor: theme.colors.dangerSoft,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderLeftWidth: 3,
    borderLeftColor: theme.colors.danger,
  },
});
