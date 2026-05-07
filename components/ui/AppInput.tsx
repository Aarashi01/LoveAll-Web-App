import { useState } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';

import { theme } from '@/constants/theme';

type AppInputProps = {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'email-address' | 'number-pad';
  secureTextEntry?: boolean;
  maxLength?: number;
  autoCapitalize?: TextInputProps['autoCapitalize'];
  autoCorrect?: boolean;
  editable?: boolean;
  containerStyle?: StyleProp<ViewStyle>;
  errorText?: string;
};

// Nike-style input: tiny uppercase eyebrow label above, sharp box, ink border
// on focus, no shadows.
export function AppInput({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType = 'default',
  secureTextEntry = false,
  maxLength,
  autoCapitalize = 'sentences',
  autoCorrect = false,
  editable = true,
  containerStyle,
  errorText,
}: AppInputProps) {
  const [focused, setFocused] = useState(false);

  return (
    <View style={[styles.wrap, containerStyle]}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={[
          styles.input,
          focused && styles.inputFocused,
          !!errorText && styles.inputError,
          !editable && styles.inputDisabled,
        ]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.colors.textSubtle}
        keyboardType={keyboardType}
        secureTextEntry={secureTextEntry}
        maxLength={maxLength}
        autoCapitalize={autoCapitalize}
        autoCorrect={autoCorrect}
        editable={editable}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
      />
      {errorText ? <Text style={styles.errorText}>{errorText}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 6,
  },
  label: {
    color: theme.colors.text,
    fontWeight: '800',
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  input: {
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 12,
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: '500',
    ...(typeof window !== 'undefined' && ({ outlineStyle: 'none' } as any)),
  },
  inputFocused: {
    borderColor: theme.colors.text,
  },
  inputError: {
    borderColor: theme.colors.danger,
    backgroundColor: theme.colors.dangerSoft,
  },
  inputDisabled: {
    backgroundColor: theme.colors.surfaceSoft,
    color: theme.colors.textMuted,
  },
  errorText: {
    color: theme.colors.danger,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2,
    letterSpacing: 0.2,
  },
});
