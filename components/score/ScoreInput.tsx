import React, { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type ScoreInputProps = {
  label: string;
  score: number;
  onTapCard: () => void;
  onIncrease: () => void;
  disabled?: boolean;
  isServing?: boolean;
  onSetServer?: () => void;
};

export function ScoreInput({ label, score, onTapCard, onIncrease, disabled, isServing, onSetServer }: ScoreInputProps) {
  const scale = useSharedValue(1);
  const scoreScale = useSharedValue(1);
  const servePulse = useSharedValue(1);

  useEffect(() => {
    // Trigger pop animation when score changes
    scoreScale.value = withSequence(
      withTiming(1.2, { duration: 100 }),
      withSpring(1, { damping: 10, stiffness: 200 })
    );
  }, [score, scoreScale]);

  useEffect(() => {
    if (isServing) {
      servePulse.value = withRepeat(withTiming(0.4, { duration: 800 }), -1, true);
    } else {
      servePulse.value = 1;
    }
  }, [isServing, servePulse]);

  const handlePressIn = () => {
    if (disabled) return;
    scale.value = withSpring(0.97, { damping: 15, stiffness: 300 });
  };

  const handlePressOut = () => {
    if (disabled) return;
    scale.value = withSpring(1, { damping: 15, stiffness: 300 });
  };

  const animatedCardStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: disabled ? 0.7 : 1,
  }));

  const animatedScoreStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scoreScale.value }],
  }));

  const animatedServeStyle = useAnimatedStyle(() => ({
    opacity: servePulse.value,
  }));

  return (
    <View style={styles.container}>
      <AnimatedPressable
        style={[styles.card, animatedCardStyle, isServing && styles.cardServing]}
        onPress={disabled ? undefined : onTapCard}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
      >
        <Pressable style={styles.headerRow} onPress={disabled ? undefined : onSetServer}>
          {isServing && <Animated.View style={[styles.servingDot, animatedServeStyle]} />}
          <Text style={styles.label}>{label}</Text>
        </Pressable>
        <Animated.Text style={[styles.score, animatedScoreStyle]}>{score}</Animated.Text>
      </AnimatedPressable>

      <View style={styles.controlsRow}>
        <AnimatedPressable
          style={[styles.controlButton, styles.increaseButton, disabled && styles.controlButtonDisabled]}
          onPress={disabled ? undefined : onIncrease}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
        >
          <Text style={styles.controlLabel}>+1 point</Text>
        </AnimatedPressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    gap: 10,
  },
  card: {
    flex: 1,
    minHeight: 220,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    backgroundColor: 'rgba(30, 41, 59, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 20,
    gap: 8,
    ...(typeof window !== 'undefined' && {
      backdropFilter: 'blur(16px)',
      boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.3)',
    }),
  },
  cardServing: {
    borderColor: 'rgba(16, 185, 129, 0.4)',
    backgroundColor: 'rgba(30, 41, 59, 0.8)',
    ...(typeof window !== 'undefined' && {
      boxShadow: '0 8px 32px 0 rgba(16, 185, 129, 0.15)',
    }),
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  servingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#10B981',
    ...(typeof window !== 'undefined' && {
      boxShadow: '0 0 8px #10B981',
    }),
  },
  label: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '800',
    color: '#94A3B8',
    textAlign: 'center',
    letterSpacing: 1,
  },
  score: {
    fontSize: 100,
    lineHeight: 110,
    fontWeight: '900',
    color: '#F8FAFC',
    textShadowColor: 'rgba(59, 130, 246, 0.5)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 20,
    marginTop: 4,
  },
  controlsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  controlButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    minHeight: 64,
    ...(typeof window !== 'undefined' && {
      boxShadow: '0 4px 12px 0 rgba(0, 0, 0, 0.2)',
    }),
  },
  increaseButton: {
    backgroundColor: 'rgba(16, 185, 129, 0.8)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.5)',
  },
  controlButtonDisabled: {
    backgroundColor: 'rgba(100, 116, 139, 0.5)',
    borderColor: 'rgba(100, 116, 139, 0.3)',
    ...(typeof window !== 'undefined' && {
      boxShadow: 'none',
    }),
  },
  controlLabel: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 24,
    lineHeight: 28,
  },
});
