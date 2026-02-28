import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

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
                        {/* User info */}
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

                        {/* Menu items */}
                        <Pressable
                            style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]}
                            onPress={() => {
                                setOpen(false);
                                router.push('/(organizer)/dashboard');
                            }}
                        >
                            <MaterialCommunityIcons name="view-dashboard-outline" size={20} color="#94A3B8" />
                            <Text style={styles.menuItemText}>Dashboard</Text>
                        </Pressable>

                        <View style={styles.divider} />

                        <Pressable
                            style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]}
                            onPress={() => void handleLogout()}
                        >
                            <MaterialCommunityIcons name="logout" size={20} color="#EF4444" />
                            <Text style={[styles.menuItemText, styles.logoutText]}>Log Out</Text>
                        </Pressable>
                    </View>
                </Pressable>
            </Modal>
        </>
    );
}

const styles = StyleSheet.create({
    avatarButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(59, 130, 246, 0.2)',
        borderWidth: 1.5,
        borderColor: 'rgba(59, 130, 246, 0.4)',
        alignItems: 'center',
        justifyContent: 'center',
        ...(typeof window !== 'undefined' && {
            cursor: 'pointer',
            transition: 'all 0.15s ease',
        }),
    },
    avatarText: {
        color: '#60A5FA',
        fontSize: 13,
        fontWeight: '900',
        letterSpacing: 0.5,
    },
    backdrop: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'flex-start',
        alignItems: 'flex-end',
        paddingTop: 56,
        paddingRight: 16,
        ...(typeof window !== 'undefined' && {
            backdropFilter: 'blur(2px)',
        }),
    },
    menuCard: {
        width: 260,
        backgroundColor: 'rgba(22, 33, 54, 0.98)',
        borderRadius: 20,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
        overflow: 'hidden',
        ...(typeof window !== 'undefined' && {
            backdropFilter: 'blur(24px)',
            boxShadow: '0 16px 48px rgba(0, 0, 0, 0.5)',
        }),
    },
    userRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        padding: 16,
    },
    avatarLarge: {
        width: 42,
        height: 42,
        borderRadius: 21,
        backgroundColor: 'rgba(59, 130, 246, 0.2)',
        borderWidth: 1.5,
        borderColor: 'rgba(59, 130, 246, 0.4)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarLargeText: {
        color: '#60A5FA',
        fontSize: 16,
        fontWeight: '900',
    },
    userInfo: {
        flex: 1,
        gap: 2,
    },
    userName: {
        color: '#F8FAFC',
        fontSize: 15,
        fontWeight: '800',
    },
    userEmail: {
        color: '#64748B',
        fontSize: 12,
        fontWeight: '600',
    },
    divider: {
        height: 1,
        backgroundColor: 'rgba(255, 255, 255, 0.06)',
    },
    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingHorizontal: 16,
        paddingVertical: 14,
    },
    menuItemPressed: {
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
    },
    menuItemText: {
        color: '#CBD5E1',
        fontSize: 15,
        fontWeight: '700',
    },
    logoutText: {
        color: '#EF4444',
    },
});
