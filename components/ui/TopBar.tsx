import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { theme } from '@/constants/theme';
import { ProfileMenu } from './ProfileMenu';

type TopBarProps = {
  showProfile?: boolean;
  onLogoPress?: () => void;
  rightSlot?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
};

// Nike-inspired sticky bar: bold wordmark left, optional right slot, profile.
// Crisp white surface, hairline bottom border, no blur.
export function TopBar({ showProfile = true, onLogoPress, rightSlot, style }: TopBarProps) {
  const handleLogo = onLogoPress ?? (() => router.push('/(organizer)/dashboard'));

  return (
    <View style={[styles.bar, style]}>
      <Pressable onPress={handleLogo} style={styles.logoWrap} hitSlop={8}>
        <View style={styles.logoBlock}>
          <Text style={styles.logoMark}>L</Text>
        </View>
        <Text style={styles.logoWord}>LOVEALL</Text>
      </Pressable>
      <View style={styles.rightSide}>
        {rightSlot}
        {showProfile ? <ProfileMenu /> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 64,
    paddingHorizontal: theme.spacing.xl,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    zIndex: 10,
  },
  logoWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    ...(typeof window !== 'undefined' && ({ cursor: 'pointer' } as any)),
  },
  logoBlock: {
    width: 28,
    height: 28,
    backgroundColor: theme.colors.text,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoMark: {
    color: theme.colors.textInverse,
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  logoWord: {
    color: theme.colors.text,
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  rightSide: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
});
