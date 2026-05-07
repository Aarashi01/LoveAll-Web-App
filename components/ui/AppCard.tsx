import { type ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { theme } from '@/constants/theme';

type AppCardProps = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  inverse?: boolean;
};

// Nike-style card: paper surface, sharp corners, 1px hairline border, no blur.
export function AppCard({ children, style, inverse = false }: AppCardProps) {
  return <View style={[styles.card, inverse && styles.cardInverse, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    padding: theme.spacing.xl,
    gap: theme.spacing.md,
  },
  cardInverse: {
    backgroundColor: theme.colors.surfaceInverse,
    borderColor: theme.colors.surfaceInverse,
  },
});
