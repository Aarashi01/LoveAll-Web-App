import React, { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withTiming,
} from 'react-native-reanimated';

type IntervalTimerProps = {
    /** Duration in seconds (60 for mid-game, 120 for between games) */
    durationSeconds: number;
    /** What type of interval this is */
    type: 'mid-game' | 'between-games' | 'change-ends';
    /** Whether the modal is visible */
    visible: boolean;
    /** Called when the timer expires or user dismisses */
    onDismiss: () => void;
    /** Optional message to display */
    message?: string;
};

export function IntervalTimer({
    durationSeconds,
    type,
    visible,
    onDismiss,
    message,
}: IntervalTimerProps) {
    const [remaining, setRemaining] = useState(durationSeconds);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const progress = useSharedValue(1);

    useEffect(() => {
        if (!visible) {
            setRemaining(durationSeconds);
            progress.value = 1;
            return;
        }

        setRemaining(durationSeconds);
        progress.value = withTiming(0, { duration: durationSeconds * 1000 });

        intervalRef.current = setInterval(() => {
            setRemaining((prev) => {
                if (prev <= 1) {
                    if (intervalRef.current) clearInterval(intervalRef.current);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, [visible, durationSeconds, progress]);

    useEffect(() => {
        if (remaining === 0 && visible) {
            // Auto-dismiss after a short delay so the user sees "0:00"
            const timeout = setTimeout(onDismiss, 800);
            return () => clearTimeout(timeout);
        }
    }, [remaining, visible, onDismiss]);

    const animatedRingStyle = useAnimatedStyle(() => ({
        transform: [{ scaleX: progress.value }],
    }));

    const minutes = Math.floor(remaining / 60);
    const seconds = remaining % 60;
    const timeDisplay = `${minutes}:${seconds.toString().padStart(2, '0')}`;

    const label =
        type === 'mid-game'
            ? 'Mid-Game Interval'
            : type === 'between-games'
                ? 'Between Games Interval'
                : 'Change Ends';

    const emoji = type === 'change-ends' ? '🔄' : '⏱️';

    const defaultMessage =
        type === 'mid-game'
            ? 'Leading score reached 11. Players may take a 60-second interval.'
            : type === 'between-games'
                ? 'Game complete. Players take a 2-minute interval before the next game.'
                : 'Players change ends of the court.';

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
            <View style={styles.overlay}>
                <View style={styles.card}>
                    <Text style={styles.emoji}>{emoji}</Text>
                    <Text style={styles.label}>{label}</Text>
                    <Text style={styles.timer}>{timeDisplay}</Text>

                    {/* Progress bar */}
                    <View style={styles.progressTrack}>
                        <Animated.View style={[styles.progressFill, animatedRingStyle]} />
                    </View>

                    <Text style={styles.message}>{message ?? defaultMessage}</Text>

                    <Pressable style={styles.resumeButton} onPress={onDismiss}>
                        <Text style={styles.resumeText}>Resume Play</Text>
                    </Pressable>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        ...(typeof window !== 'undefined' && {
            backdropFilter: 'blur(8px)',
        }),
    },
    card: {
        width: '100%',
        maxWidth: 380,
        backgroundColor: 'rgba(15, 23, 42, 0.95)',
        borderRadius: 28,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
        padding: 32,
        alignItems: 'center',
        gap: 16,
        ...(typeof window !== 'undefined' && {
            boxShadow: '0 24px 64px rgba(0, 0, 0, 0.5)',
            backdropFilter: 'blur(16px)',
        }),
    },
    emoji: {
        fontSize: 48,
    },
    label: {
        color: '#94A3B8',
        fontSize: 14,
        fontWeight: '800',
        letterSpacing: 2,
        textTransform: 'uppercase',
    },
    timer: {
        color: '#F8FAFC',
        fontSize: 72,
        fontWeight: '900',
        letterSpacing: -2,
        lineHeight: 80,
    },
    progressTrack: {
        width: '100%',
        height: 6,
        borderRadius: 3,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        overflow: 'hidden',
    },
    progressFill: {
        height: '100%',
        backgroundColor: '#10B981',
        borderRadius: 3,
        transformOrigin: 'left',
    },
    message: {
        color: '#94A3B8',
        fontSize: 15,
        fontWeight: '600',
        textAlign: 'center',
        lineHeight: 22,
    },
    resumeButton: {
        marginTop: 8,
        backgroundColor: 'rgba(16, 185, 129, 0.15)',
        borderWidth: 1,
        borderColor: 'rgba(16, 185, 129, 0.4)',
        borderRadius: 16,
        paddingHorizontal: 32,
        paddingVertical: 14,
        ...(typeof window !== 'undefined' && {
            boxShadow: '0 4px 16px rgba(16, 185, 129, 0.2)',
        }),
    },
    resumeText: {
        color: '#10B981',
        fontSize: 17,
        fontWeight: '900',
        letterSpacing: 0.5,
    },
});
