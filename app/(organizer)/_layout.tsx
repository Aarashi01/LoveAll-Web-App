import { Stack } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import 'react-native-reanimated';

import { ProfileMenu } from '@/components/ui/ProfileMenu';
import { theme } from '@/constants/theme';

export default function OrganizerLayout() {
    return (
        <View style={styles.container}>
            {/* Persistent profile icon — always at top right */}
            <View style={styles.profileBar}>
                <ProfileMenu />
            </View>
            <Stack screenOptions={{ headerShown: false }} />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: theme.colors.background,
    },
    profileBar: {
        position: 'absolute',
        top: 12,
        right: 16,
        zIndex: 100,
        ...(typeof window !== 'undefined' && {
            pointerEvents: 'auto',
        }),
    },
});
