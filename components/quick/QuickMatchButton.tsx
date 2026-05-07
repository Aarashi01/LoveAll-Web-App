import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { theme } from '@/constants/theme';

interface Props {
  style?: StyleProp<ViewStyle>;
  variant?: 'inverse' | 'paper';
}

// Nike-style "QUICK MATCH" CTA. Renders dark on a paper background and inverted
// on an ink hero band. Imperative copy, sharp geometry, single accent dot.
export function QuickMatchButton({ style, variant = 'paper' }: Props) {
  const inverse = variant === 'inverse';
  return (
    <Pressable
      onPress={() => router.push('/quick')}
      style={({ pressed, hovered }: any) => [
        styles.button,
        inverse ? styles.buttonInverse : styles.buttonPaper,
        hovered && (inverse ? styles.buttonInverseHover : styles.buttonPaperHover),
        pressed && styles.pressed,
        style,
      ]}
      accessibilityRole="button"
      accessibilityLabel="Start a Quick Match — no login required"
    >
      <View style={styles.dotWrap}>
        <View style={[styles.dot, inverse && styles.dotInverse]} />
      </View>
      <View style={styles.textWrap}>
        <Text style={[styles.label, inverse && styles.labelInverse]}>QUICK MATCH</Text>
        <Text style={[styles.sublabel, inverse && styles.sublabelInverse]}>
          No login. No tournament. Just score.
        </Text>
      </View>
      <Text style={[styles.arrow, inverse && styles.arrowInverse]}>→</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderWidth: 1.5,
    gap: 14,
    ...(typeof window !== 'undefined' && ({
      transition: 'background-color 120ms ease, color 120ms ease, border-color 120ms ease',
      cursor: 'pointer',
    } as any)),
  },
  buttonPaper: {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.text,
  },
  buttonPaperHover: {
    backgroundColor: theme.colors.text,
  },
  buttonInverse: {
    backgroundColor: 'transparent',
    borderColor: 'rgba(255,255,255,0.4)',
  },
  buttonInverseHover: {
    backgroundColor: theme.colors.textInverse,
    borderColor: theme.colors.textInverse,
  },
  pressed: { opacity: 0.85 },
  dotWrap: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.live,
  },
  dotInverse: {
    backgroundColor: theme.colors.live,
  },
  textWrap: { flex: 1 },
  label: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 1.4,
  },
  labelInverse: {
    color: theme.colors.textInverse,
  },
  sublabel: {
    color: theme.colors.textMuted,
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
  sublabelInverse: {
    color: 'rgba(255,255,255,0.7)',
  },
  arrow: {
    color: theme.colors.text,
    fontSize: 18,
    fontWeight: '900',
  },
  arrowInverse: {
    color: theme.colors.textInverse,
  },
});
