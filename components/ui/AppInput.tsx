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
      <Text style={[styles.label, focused && styles.labelFocused]}>{label}</Text>
      <TextInput
        style={[styles.input, focused && styles.inputFocused, !!errorText && styles.inputError]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.colors.textMuted}
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
    gap: 8,
  },
  label: {
    color: '#94A3B8', // Slate 400
    fontWeight: '600',
    fontSize: 13,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  labelFocused: {
    color: theme.colors.accent,
  },
  input: {
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: theme.radius.lg,
    backgroundColor: 'rgba(15, 23, 42, 0.4)', // Very subtle dark center
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: 14,
    color: theme.colors.text,
    fontSize: 16,
    // Add subtle inner shadow for depth effect (web)
    ...(typeof window !== 'undefined' && {
      boxShadow: 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.1)',
    }),
  },
  inputFocused: {
    borderColor: theme.colors.accent,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    ...(typeof window !== 'undefined' && {
      boxShadow: `0 0 0 1px ${theme.colors.accent}, inset 0 2px 4px 0 rgba(0, 0, 0, 0.1)`,
      outlineStyle: 'none',
    }),
  },
  inputError: {
    borderColor: theme.colors.danger,
    backgroundColor: 'rgba(239, 68, 68, 0.05)',
  },
  errorText: {
    color: theme.colors.danger,
    fontSize: 12,
    fontWeight: '600',
    marginTop: -2,
  },
});
