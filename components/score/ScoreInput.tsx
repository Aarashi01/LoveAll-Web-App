import React, { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
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
  onDecrease: () => void;
};

export function ScoreInput({ label, score, onTapCard, onIncrease, onDecrease }: ScoreInputProps) {
  const scale = useSharedValue(1);
  const scoreScale = useSharedValue(1);

  useEffect(() => {
    // Trigger pop animation when score changes
    scoreScale.value = withSequence(
      withTiming(1.2, { duration: 100 }),
      withSpring(1, { damping: 10, stiffness: 200 })
    );
  }, [score, scoreScale]);

  const handlePressIn = () => {
    scale.value = withSpring(0.97, { damping: 15, stiffness: 300 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15, stiffness: 300 });
  };

  const animatedCardStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const animatedScoreStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scoreScale.value }],
  }));

  return (
    <View style={styles.container}>
      <AnimatedPressable
        style={[styles.card, animatedCardStyle]}
        onPress={onTapCard}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
      >
        <Text style={styles.label}>{label}</Text>
        <Animated.Text style={[styles.score, animatedScoreStyle]}>{score}</Animated.Text>
      </AnimatedPressable>

      <View style={styles.controlsRow}>
        <AnimatedPressable
          style={[styles.controlButton, styles.decreaseButton]}
          onPress={onDecrease}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
        >
          <Text style={styles.controlLabel}>-1</Text>
        </AnimatedPressable>
        <AnimatedPressable
          style={[styles.controlButton, styles.increaseButton]}
          onPress={onIncrease}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
        >
          <Text style={styles.controlLabel}>+1</Text>
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
  label: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '800',
    color: '#94A3B8',
    textAlign: 'center',
    letterSpacing: 1,
  },
  score: {
    fontSize: 110,
    lineHeight: 110,
    fontWeight: '900',
    color: '#F8FAFC',
    textShadowColor: 'rgba(59, 130, 246, 0.5)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 20,
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
  decreaseButton: {
    backgroundColor: 'rgba(239, 68, 68, 0.8)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.5)',
  },
  increaseButton: {
    backgroundColor: 'rgba(16, 185, 129, 0.8)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.5)',
  },
  controlLabel: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 24,
    lineHeight: 28,
  },
});
