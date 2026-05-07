import { router } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '@/components/ui/AppButton';
import { theme } from '@/constants/theme';
import {
  currentServer,
  gamesNeededToWinMatch,
  type Side,
} from '@/lib/quick-match-engine';
import { useQuickMatchStore } from '@/store/quick-match.store';

export default function QuickMatchPlay() {
  const match = useQuickMatchStore((s) => s.match);
  const scorePoint = useQuickMatchStore((s) => s.scorePoint);
  const undo = useQuickMatchStore((s) => s.undo);
  const rematch = useQuickMatchStore((s) => s.rematch);
  const reset = useQuickMatchStore((s) => s.reset);

  useEffect(() => {
    if (!match) router.replace('/quick');
  }, [match]);

  if (!match) return null;

  const isOver = match.matchWinner !== null;
  const winnerSide: Side | null = match.matchWinner;
  const winnerName =
    winnerSide === 'A' ? match.sideAName : winnerSide === 'B' ? match.sideBName : null;
  const aGameWins = match.completedGames.filter((g) => g.winner === 'A').length;
  const bGameWins = match.completedGames.filter((g) => g.winner === 'B').length;
  const need = gamesNeededToWinMatch(match.rules);
  const server = currentServer(match);

  const formatLabel = match.format === 'doubles' ? 'Doubles' : 'Singles';
  const rulesLabel = `${match.rules.pointsToWin} pts · Best of ${match.rules.bestOf}${match.rules.deuceEnabled ? ' · Deuce' : ''}`;

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.topbar}>
        <Pressable
          onPress={() => {
            reset();
            router.replace('/quick');
          }}
          style={styles.exitBtn}
          hitSlop={8}
        >
          <Text style={styles.exitText}>← Exit</Text>
        </Pressable>
        <Text style={styles.topbarMeta}>
          {formatLabel.toUpperCase()} · {rulesLabel.toUpperCase()}
        </Text>
        <View style={{ width: 56 }} />
      </View>

      {isOver ? (
        <View style={styles.completeWrap}>
          <Text style={styles.completeEyebrow}>Match Complete</Text>
          <Text style={styles.completeWinner}>{winnerName}</Text>
          <Text style={styles.completeWins}>WINS.</Text>
          <Text style={styles.completeSub}>
            Best of {match.rules.bestOf} · {aGameWins}–{bGameWins}
          </Text>
          {match.completedGames.length > 0 ? (
            <View style={styles.scoreSummary}>
              {match.completedGames.map((g, i) => (
                <View key={i} style={styles.scoreLineRow}>
                  <Text style={styles.scoreLineLabel}>GAME {i + 1}</Text>
                  <Text style={styles.scoreLineValue}>
                    {g.a}–{g.b}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}
          <View style={styles.completeButtons}>
            <AppButton label="Rematch" onPress={rematch} style={styles.completeBtn} />
            <AppButton
              variant="secondary"
              label="New match"
              onPress={() => {
                reset();
                router.replace('/quick');
              }}
              style={styles.completeBtn}
            />
          </View>
        </View>
      ) : (
        <>
          <View style={styles.scoreRow}>
            <SidePanel
              name={match.sideAName}
              score={match.currentGame.a}
              gamesWon={aGameWins}
              need={need}
              serving={server === 'A'}
              variant="paper"
              onPress={() => scorePoint('A')}
            />
            <SidePanel
              name={match.sideBName}
              score={match.currentGame.b}
              gamesWon={bGameWins}
              need={need}
              serving={server === 'B'}
              variant="ink"
              onPress={() => scorePoint('B')}
            />
          </View>

          <View style={styles.bottomBar}>
            <Pressable
              onPress={undo}
              disabled={match.history.length === 0}
              style={[styles.undoBtn, match.history.length === 0 && styles.undoBtnDim]}
            >
              <Text style={styles.undoBtnText}>↶ Undo</Text>
            </Pressable>
            {match.completedGames.length > 0 ? (
              <Text style={styles.completedGamesText}>
                {match.completedGames.map((g) => `${g.a}–${g.b}`).join(' · ')}
              </Text>
            ) : (
              <Text style={styles.completedGamesText}>Tap a side to score.</Text>
            )}
          </View>
        </>
      )}
    </SafeAreaView>
  );
}

function SidePanel({
  name,
  score,
  gamesWon,
  need,
  serving,
  variant,
  onPress,
}: {
  name: string;
  score: number;
  gamesWon: number;
  need: number;
  serving: boolean;
  variant: 'paper' | 'ink';
  onPress: () => void;
}) {
  const isInk = variant === 'ink';
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.side,
        isInk ? styles.sideInk : styles.sidePaper,
        serving && (isInk ? styles.sideInkServing : styles.sidePaperServing),
        pressed && styles.sidePressed,
      ]}
    >
      <View style={styles.sideHeader}>
        <Text style={[styles.sideMeta, isInk && styles.sideMetaInverse]}>
          {serving ? 'SERVING' : 'TAP TO SCORE'}
        </Text>
        <Text style={[styles.sideGames, isInk && styles.sideGamesInverse]}>
          {gamesWon} / {need}
        </Text>
      </View>
      <Text style={[styles.sideName, isInk && styles.sideNameInverse]} numberOfLines={2}>
        {name}
      </Text>
      <Text style={[styles.sideScore, isInk && styles.sideScoreInverse]}>{score}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  topbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.lg,
    paddingTop: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  exitBtn: {
    paddingVertical: 4,
  },
  exitText: {
    color: theme.colors.text,
    fontWeight: '800',
    fontSize: 13,
    letterSpacing: 0.4,
    textDecorationLine: 'underline',
  },
  topbarMeta: {
    color: theme.colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
  },

  scoreRow: {
    flex: 1,
    flexDirection: 'row',
  },
  side: {
    flex: 1,
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing.lg,
    justifyContent: 'space-between',
    ...(typeof window !== 'undefined' && ({
      cursor: 'pointer',
      userSelect: 'none',
    } as any)),
  },
  sidePaper: {
    backgroundColor: theme.colors.surface,
    borderRightWidth: 1,
    borderRightColor: theme.colors.border,
  },
  sideInk: {
    backgroundColor: theme.colors.surfaceInverse,
  },
  sidePaperServing: {
    borderTopWidth: 6,
    borderTopColor: theme.colors.live,
  },
  sideInkServing: {
    borderTopWidth: 6,
    borderTopColor: theme.colors.live,
  },
  sidePressed: {
    opacity: 0.92,
  },
  sideHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sideMeta: {
    color: theme.colors.textMuted,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.6,
  },
  sideMetaInverse: {
    color: 'rgba(255,255,255,0.6)',
  },
  sideGames: {
    color: theme.colors.text,
    fontSize: 13,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  sideGamesInverse: {
    color: theme.colors.textInverse,
  },
  sideName: {
    color: theme.colors.text,
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.6,
  },
  sideNameInverse: {
    color: theme.colors.textInverse,
  },
  sideScore: {
    color: theme.colors.text,
    fontSize: 200,
    fontWeight: '900',
    letterSpacing: -8,
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
    lineHeight: 200,
  },
  sideScoreInverse: {
    color: theme.colors.textInverse,
  },

  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
    paddingTop: 12,
    paddingBottom: 18,
    gap: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  undoBtn: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: theme.radius.full,
    borderWidth: 1.5,
    borderColor: theme.colors.text,
    backgroundColor: theme.colors.surface,
  },
  undoBtnDim: {
    opacity: 0.35,
  },
  undoBtnText: {
    color: theme.colors.text,
    fontWeight: '800',
    fontSize: 13,
    letterSpacing: 0.4,
  },
  completedGamesText: {
    flex: 1,
    color: theme.colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },

  completeWrap: {
    flex: 1,
    alignItems: 'flex-start',
    justifyContent: 'center',
    padding: theme.spacing.xl,
    maxWidth: 720,
    width: '100%',
    alignSelf: 'center',
    gap: 4,
  },
  completeEyebrow: {
    color: theme.colors.live,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.8,
    textTransform: 'uppercase',
  },
  completeWinner: {
    color: theme.colors.text,
    fontSize: 80,
    fontWeight: '900',
    letterSpacing: -3,
    lineHeight: 80,
  },
  completeWins: {
    color: theme.colors.text,
    fontSize: 80,
    fontWeight: '900',
    letterSpacing: -3,
    lineHeight: 80,
  },
  completeSub: {
    color: theme.colors.textMuted,
    fontSize: 14,
    fontWeight: '600',
    marginTop: theme.spacing.md,
  },
  scoreSummary: {
    marginTop: theme.spacing.lg,
    gap: 6,
    width: '100%',
    maxWidth: 320,
  },
  scoreLineRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    paddingVertical: 8,
  },
  scoreLineLabel: {
    color: theme.colors.text,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.4,
  },
  scoreLineValue: {
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  completeButtons: {
    flexDirection: 'row',
    gap: 8,
    marginTop: theme.spacing.xl,
    width: '100%',
    maxWidth: 420,
  },
  completeBtn: {
    flex: 1,
  },
});
