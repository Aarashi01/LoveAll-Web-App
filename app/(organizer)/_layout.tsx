import { Stack } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import 'react-native-reanimated';

import { TopBar } from '@/components/ui/TopBar';
import { theme } from '@/constants/theme';

export default function OrganizerLayout() {
    return (
        <View style={styles.container}>
            <TopBar />
            <View style={styles.content}>
                <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.colors.background } }} />
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: theme.colors.background,
    },
    content: {
        flex: 1,
    },
});
