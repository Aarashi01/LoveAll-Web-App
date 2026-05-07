import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { theme } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';

export function ProfileMenu() {
    const { user, logout } = useAuth();
    const [open, setOpen] = useState(false);

    if (!user || user.isAnonymous) return null;

    const initials = (user.email ?? 'U')
        .split('@')[0]
        .slice(0, 2)
        .toUpperCase();

    const handleLogout = async () => {
        setOpen(false);
        await logout();
        router.replace('/(auth)/login');
    };

    return (
        <>
            <Pressable
                style={styles.avatarButton}
                onPress={() => setOpen(true)}
                hitSlop={8}
            >
                <Text style={styles.avatarText}>{initials}</Text>
            </Pressable>

            <Modal
                visible={open}
                transparent
                animationType="fade"
                onRequestClose={() => setOpen(false)}
            >
                <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
                    <View style={styles.menuCard}>
                        <View style={styles.userRow}>
                            <View style={styles.avatarLarge}>
                                <Text style={styles.avatarLargeText}>{initials}</Text>
                            </View>
                            <View style={styles.userInfo}>
                                <Text style={styles.userName} numberOfLines={1}>
                                    {user.email?.split('@')[0] ?? 'User'}
                                </Text>
                                <Text style={styles.userEmail} numberOfLines={1}>
                                    {user.email ?? ''}
                                </Text>
                            </View>
                        </View>

                        <View style={styles.divider} />

                        <Pressable
                            style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]}
                            onPress={() => {
                                setOpen(false);
                                router.push('/(organizer)/dashboard');
                            }}
                        >
                            <MaterialCommunityIcons name="view-dashboard-outline" size={20} color={theme.colors.text} />
                            <Text style={styles.menuItemText}>Dashboard</Text>
                        </Pressable>

                        <View style={styles.divider} />

                        <Pressable
                            style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]}
                            onPress={() => void handleLogout()}
                        >
                            <MaterialCommunityIcons name="logout" size={20} color={theme.colors.danger} />
                            <Text style={[styles.menuItemText, styles.logoutText]}>Log out</Text>
                        </Pressable>
                    </View>
                </Pressable>
            </Modal>
        </>
    );
}

const styles = StyleSheet.create({
    avatarButton: {
        width: 38,
        height: 38,
        borderRadius: theme.radius.full,
        backgroundColor: theme.colors.text,
        alignItems: 'center',
        justifyContent: 'center',
        ...(typeof window !== 'undefined' && {
            cursor: 'pointer',
            transition: 'transform 120ms ease',
        } as any),
    },
    avatarText: {
        color: theme.colors.textInverse,
        fontSize: 13,
        fontWeight: '900',
        letterSpacing: 0.6,
    },
    backdrop: {
        flex: 1,
        backgroundColor: 'rgba(17, 17, 17, 0.18)',
        justifyContent: 'flex-start',
        alignItems: 'flex-end',
        paddingTop: 64,
        paddingRight: 16,
    },
    menuCard: {
        width: 280,
        backgroundColor: theme.colors.surface,
        borderRadius: theme.radius.md,
        borderWidth: 1,
        borderColor: theme.colors.border,
        overflow: 'hidden',
    },
    userRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        padding: 16,
    },
    avatarLarge: {
        width: 44,
        height: 44,
        borderRadius: theme.radius.full,
        backgroundColor: theme.colors.text,
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarLargeText: {
        color: theme.colors.textInverse,
        fontSize: 16,
        fontWeight: '900',
    },
    userInfo: {
        flex: 1,
        gap: 2,
    },
    userName: {
        color: theme.colors.text,
        fontSize: 15,
        fontWeight: '800',
    },
    userEmail: {
        color: theme.colors.textMuted,
        fontSize: 12,
        fontWeight: '500',
    },
    divider: {
        height: 1,
        backgroundColor: theme.colors.border,
    },
    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingHorizontal: 16,
        paddingVertical: 14,
    },
    menuItemPressed: {
        backgroundColor: theme.colors.surfaceSoft,
    },
    menuItemText: {
        color: theme.colors.text,
        fontSize: 14,
        fontWeight: '700',
    },
    logoutText: {
        color: theme.colors.danger,
    },
});
