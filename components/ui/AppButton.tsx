import { useState } from 'react';
import { Pressable, StyleSheet, Text, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';

import { theme } from '@/constants/theme';

type Variant = 'primary' | 'secondary' | 'danger';

type AppButtonProps = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: Variant;
  style?: StyleProp<ViewStyle>;
  labelStyle?: StyleProp<TextStyle>;
};

export function AppButton({
  label,
  onPress,
  disabled = false,
  variant = 'primary',
  style,
  labelStyle,
}: AppButtonProps) {
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);

  return (
    <Pressable
      style={({ pressed }) => [
        styles.base,
        variant === 'primary' && styles.primary,
        variant === 'secondary' && styles.secondary,
        variant === 'danger' && styles.danger,
        hovered && !disabled && styles.hovered,
        pressed && !disabled && styles.pressed,
        focused && !disabled && styles.focused,
        disabled && styles.disabled,
        style,
      ]}
      onPress={onPress}
      disabled={disabled}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
    >
      <Text
        style={[
          styles.label,
          variant === 'secondary' && styles.secondaryLabel,
          labelStyle,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 52, // Slightly taller for better touch target and presence
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.xl,
    // Base shadow
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
    // Smooth transition
    ...(typeof window !== 'undefined' && {
      transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
      cursor: 'pointer',
    }),
  },
  primary: {
    backgroundColor: theme.colors.accent, // Using the vibrant electric blue
    borderColor: 'rgba(255, 255, 255, 0.1)',
    ...(typeof window !== 'undefined' && {
      backgroundImage: `linear-gradient(180deg, ${theme.colors.accent} 0%, rgba(37, 99, 235, 1) 100%)`, // Blue 500 to Blue 600
      boxShadow: `0 4px 14px 0 rgba(59, 130, 246, 0.39), inset 0 1px 0 rgba(255, 255, 255, 0.2)`,
    }),
  },
  secondary: {
    backgroundColor: 'rgba(30, 41, 59, 0.8)', // Slate 800 with opacity
    borderColor: 'rgba(255, 255, 255, 0.1)',
    ...(typeof window !== 'undefined' && {
      backdropFilter: 'blur(8px)',
      boxShadow: '0 4px 14px 0 rgba(0, 0, 0, 0.2)',
    }),
  },
  danger: {
    backgroundColor: theme.colors.danger,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    ...(typeof window !== 'undefined' && {
      backgroundImage: `linear-gradient(180deg, ${theme.colors.danger} 0%, rgba(220, 38, 38, 1) 100%)`,
      boxShadow: `0 4px 14px 0 rgba(239, 68, 68, 0.39), inset 0 1px 0 rgba(255, 255, 255, 0.2)`,
    }),
  },
  hovered: {
    ...(typeof window !== 'undefined' && {
      transform: 'translateY(-2px)',
      boxShadow: `0 6px 20px rgba(59, 130, 246, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.2)`,
    }),
  },
  pressed: {
    ...(typeof window !== 'undefined' ? {
      transform: 'translateY(1px)',
      boxShadow: `0 2px 8px rgba(59, 130, 246, 0.3), inset 0 2px 4px rgba(0, 0, 0, 0.2)`,
    } : {
      opacity: 0.8,
    }),
  },
  focused: {
    borderColor: theme.colors.focus,
    borderWidth: 2,
    ...(typeof window !== 'undefined' && {
      outlineStyle: 'none' as const, // Fix type error by asserting as const
      boxShadow: `0 0 0 3px rgba(16, 185, 129, 0.5)`,
    } as any), // Use 'as any' since react-native-web types don't officially support all CSS properties
  },
  disabled: {
    opacity: 0.5,
    ...(typeof window !== 'undefined' && {
      cursor: 'not-allowed',
      transform: 'none',
    } as any),
  },
  label: {
    color: '#FFFFFF',
    fontWeight: '700', // Slightly scaled back from 800 for geometric fonts
    fontSize: 16,
    letterSpacing: 0.5,
  },
  secondaryLabel: {
    color: theme.colors.text,
  },
});
