import { useState } from 'react';
import { Pressable, StyleSheet, Text, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';

import { theme } from '@/constants/theme';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';

type AppButtonProps = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: Variant;
  style?: StyleProp<ViewStyle>;
  labelStyle?: StyleProp<TextStyle>;
};

// Nike-style action buttons: pill-shaped, ink-on-paper or paper-on-ink,
// heavy uppercase label, single underline-like hover lift. No gradients,
// no inset shadows, no blur — just decisive contrast.
export function AppButton({
  label,
  onPress,
  disabled = false,
  variant = 'primary',
  style,
  labelStyle,
}: AppButtonProps) {
  const [hovered, setHovered] = useState(false);

  return (
    <Pressable
      style={({ pressed }) => [
        styles.base,
        variant === 'primary' && styles.primary,
        variant === 'secondary' && styles.secondary,
        variant === 'danger' && styles.danger,
        variant === 'ghost' && styles.ghost,
        hovered && !disabled && variant === 'primary' && styles.primaryHover,
        hovered && !disabled && variant === 'secondary' && styles.secondaryHover,
        hovered && !disabled && variant === 'danger' && styles.dangerHover,
        hovered && !disabled && variant === 'ghost' && styles.ghostHover,
        pressed && !disabled && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}
      onPress={onPress}
      disabled={disabled}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
    >
      <Text
        style={[
          styles.label,
          variant === 'secondary' && styles.secondaryLabel,
          variant === 'danger' && styles.dangerLabel,
          variant === 'ghost' && styles.ghostLabel,
          labelStyle,
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 48,
    borderRadius: theme.radius.full,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.xl,
    ...(typeof window !== 'undefined' && {
      transition: 'background-color 120ms ease, color 120ms ease, border-color 120ms ease, transform 120ms ease',
      cursor: 'pointer',
    } as any),
  },
  primary: {
    backgroundColor: theme.colors.primary, // ink-black
    borderColor: theme.colors.primary,
  },
  primaryHover: {
    backgroundColor: '#000000',
    borderColor: '#000000',
  },
  secondary: {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.text,
  },
  secondaryHover: {
    backgroundColor: theme.colors.text,
  },
  danger: {
    backgroundColor: theme.colors.danger,
    borderColor: theme.colors.danger,
  },
  dangerHover: {
    backgroundColor: '#D70C00',
    borderColor: '#D70C00',
  },
  ghost: {
    backgroundColor: 'transparent',
    borderColor: 'transparent',
  },
  ghostHover: {
    backgroundColor: theme.colors.surfaceSoft,
  },
  pressed: {
    ...(typeof window !== 'undefined'
      ? ({ transform: 'translateY(1px)' } as any)
      : { opacity: 0.85 }),
  },
  disabled: {
    opacity: 0.35,
    ...(typeof window !== 'undefined' && ({ cursor: 'not-allowed' } as any)),
  },
  label: {
    color: theme.colors.textInverse,
    fontWeight: '800',
    fontSize: 14,
    letterSpacing: 0.4,
  },
  secondaryLabel: {
    color: theme.colors.text,
  },
  dangerLabel: {
    color: '#FFFFFF',
  },
  ghostLabel: {
    color: theme.colors.text,
  },
});
