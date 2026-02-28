import React, { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { type ServiceCourt } from '@/lib/firestore/types';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type ScoreInputProps = {
  label: string;
  partnerLabel?: string | null;
  score: number;
  onTapCard: () => void;
  onIncrease: () => void;
  disabled?: boolean;
  isServing?: boolean;
  onSetServer?: () => void;
  serviceCourt?: ServiceCourt;
  /** Whether the game is in deuce state */
  isDeuce?: boolean;
};

export function ScoreInput({
  label,
  partnerLabel,
  score,
  onTapCard,
  onIncrease,
  disabled,
  isServing,
  onSetServer,
  serviceCourt,
  isDeuce,
}: ScoreInputProps) {
  const { height: windowHeight } = useWindowDimensions();
  const scale = useSharedValue(1);
  const scoreScale = useSharedValue(1);
  const servePulse = useSharedValue(1);
  const deucePulse = useSharedValue(0);

  useEffect(() => {
    scoreScale.value = withSequence(
      withTiming(1.15, { duration: 80 }),
      withSpring(1, { damping: 12, stiffness: 200 }),
    );
  }, [score, scoreScale]);

  useEffect(() => {
    if (isServing) {
      servePulse.value = withRepeat(withTiming(0.4, { duration: 800 }), -1, true);
    } else {
      servePulse.value = 1;
    }
  }, [isServing, servePulse]);

  useEffect(() => {
    if (isDeuce) {
      deucePulse.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 600 }),
          withTiming(0, { duration: 600 }),
        ),
        -1,
        true,
      );
    } else {
      deucePulse.value = 0;
    }
  }, [isDeuce, deucePulse]);

  const handlePressIn = () => {
    if (disabled) return;
    scale.value = withSpring(0.96, { damping: 15, stiffness: 300 });
  };

  const handlePressOut = () => {
    if (disabled) return;
    scale.value = withSpring(1, { damping: 15, stiffness: 300 });
  };

  const animatedCardStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: disabled ? 0.6 : 1,
  }));

  const animatedScoreStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scoreScale.value }],
  }));

  const animatedServeStyle = useAnimatedStyle(() => ({
    opacity: servePulse.value,
  }));

  const animatedDeuceStyle = useAnimatedStyle(() => ({
    opacity: deucePulse.value * 0.4,
  }));

  // Responsive sizing — score font adapts to viewport
  const isShortScreen = windowHeight < 700;
  const scoreFontSize = isShortScreen ? 72 : 90;

  return (
    <AnimatedPressable
      style={[
        styles.card,
        animatedCardStyle,
        isServing && styles.cardServing,
      ]}
      onPress={disabled ? undefined : onTapCard}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
    >
      {/* Deuce glow overlay */}
      {isDeuce && (
        <Animated.View style={[styles.deuceOverlay, animatedDeuceStyle]} />
      )}

      {/* Server + Court indicator */}
      <View style={styles.headerRow}>
        {isServing && (
          <Pressable style={styles.serveBadge} onPress={disabled ? undefined : onSetServer}>
            <Animated.View style={[styles.serveDot, animatedServeStyle]} />
            {serviceCourt && (
              <Text style={styles.courtText}>{serviceCourt === 'right' ? 'R' : 'L'}</Text>
            )}
          </Pressable>
        )}
        {!isServing && (
          <Pressable style={styles.setServerBadge} onPress={disabled ? undefined : onSetServer}>
            <Text style={styles.setServerText}>Set Server</Text>
          </Pressable>
        )}
      </View>

      {/* Score — the primary tap target */}
      <Animated.Text style={[styles.score, { fontSize: scoreFontSize, lineHeight: scoreFontSize }, animatedScoreStyle]}>
        {score}
      </Animated.Text>

      {/* Player name(s) */}
      <View style={styles.nameContainer}>
        <Text style={styles.nameText} numberOfLines={1} ellipsizeMode="tail">
          {label}
        </Text>
        {partnerLabel ? (
          <Text style={styles.partnerText} numberOfLines={1} ellipsizeMode="tail">
            / {partnerLabel}
          </Text>
        ) : null}
      </View>

      {/* Subtle tap hint */}
      {!disabled && (
        <Text style={styles.tapHint}>Tap to score</Text>
      )}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    backgroundColor: 'rgba(30, 41, 59, 0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 16,
    gap: 4,
    position: 'relative',
    overflow: 'hidden',
    ...(typeof window !== 'undefined' && {
      backdropFilter: 'blur(16px)',
      boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.3)',
      cursor: 'pointer',
      userSelect: 'none',
      WebkitTapHighlightColor: 'transparent',
    }),
  },
  cardServing: {
    borderColor: 'rgba(16, 185, 129, 0.4)',
    backgroundColor: 'rgba(30, 41, 59, 0.85)',
    ...(typeof window !== 'undefined' && {
      boxShadow: '0 8px 32px 0 rgba(16, 185, 129, 0.15)',
    }),
  },
  deuceOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderRadius: 24,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 28,
  },
  serveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  serveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10B981',
    ...(typeof window !== 'undefined' && {
      boxShadow: '0 0 8px #10B981',
    }),
  },
  courtText: {
    color: '#10B981',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1,
  },
  setServerBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  setServerText: {
    color: '#475569',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  score: {
    fontWeight: '900',
    color: '#F8FAFC',
    textShadowColor: 'rgba(59, 130, 246, 0.4)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 24,
  },
  nameContainer: {
    alignItems: 'center',
    gap: 2,
    maxWidth: '100%',
    paddingHorizontal: 4,
  },
  nameText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#94A3B8',
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  partnerText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
    textAlign: 'center',
  },
  tapHint: {
    color: '#334155',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginTop: 2,
  },
});
