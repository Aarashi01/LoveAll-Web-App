import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";

import { GameScoreBar } from "@/components/score/GameScoreBar";
import { IntervalTimer } from "@/components/score/IntervalTimer";
import { ScoreInput } from "@/components/score/ScoreInput";
import { AppButton } from "@/components/ui/AppButton";
import { AppCard } from "@/components/ui/AppCard";
import { AppInput } from "@/components/ui/AppInput";
import { theme, toCategoryLabel, toRoundLabel } from "@/constants/theme";
import { useAuth } from "@/hooks/useAuth";
import { useTournament } from "@/hooks/useTournament";
import {
  completeMatch,
  subscribeToMatch,
  updateMatch,
  updateScore,
} from "@/lib/firestore/matches";
import {
  type MatchDocument,
  type ServiceCourt,
} from "@/lib/firestore/types";
import { activateScorekeeperSession } from "@/lib/scorekeeper-session";
import {
  applyScoreChange,
  gamesNeededToWinMatch,
  getCurrentGame,
  getServiceCourt,
  isDeuce,
  type Player,
} from "@/lib/tournament-match-engine";
import { useAppStore } from "@/store/app.store";

// ---------------------------------------------------------------------------
// Helpers (UI / formatting only — domain rules live in tournament-match-engine)
// ---------------------------------------------------------------------------

type ScoreAction = {
  gameIndex: number;
  player: Player;
  delta: 1 | -1;
};

function formatElapsed(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function isDoublesCategory(category: string): boolean {
  return category === "MD" || category === "WD" || category === "XD";
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ScoreEntryScreen() {
  const { matchId, tournamentId } = useLocalSearchParams<{
    matchId: string;
    tournamentId?: string;
  }>();
  const { user } = useAuth();
  const { tournament, loading: tournamentLoading } =
    useTournament(tournamentId);
  const scorekeeper = useAppStore((state) => state.scorekeeper);
  const { height: windowHeight } = useWindowDimensions();

  const [match, setMatch] = useState<MatchDocument | null>(null);
  const [matchLoading, setMatchLoading] = useState(true);
  const [matchError, setMatchError] = useState<string | null>(null);
  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState<string | null>(null);
  const [pinValidated, setPinValidated] = useState(false);
  const [history, setHistory] = useState<ScoreAction[]>([]);
  const [pendingWinnerId, setPendingWinnerId] = useState<string | null>(null);
  const [showEndMatchModal, setShowEndMatchModal] = useState(false);
  const [showCelebrationModal, setShowCelebrationModal] = useState(false);
  const [activeServer, setActiveServer] = useState<"p1" | "p2" | null>(null);

  // BWF interval state
  const [intervalType, setIntervalType] = useState<
    "mid-game" | "between-games" | "change-ends" | null
  >(null);
  const [intervalMessage, setIntervalMessage] = useState<string | undefined>(
    undefined,
  );

  // Match timer
  const [matchStartTime, setMatchStartTime] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Start match timer on first point
  useEffect(() => {
    if (matchStartTime && !timerRef.current) {
      timerRef.current = setInterval(() => {
        setElapsed(Math.floor((Date.now() - matchStartTime) / 1000));
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [matchStartTime]);

  useEffect(() => {
    const hasActivePinSession =
      !!tournamentId &&
      scorekeeper.active &&
      scorekeeper.tournamentId === tournamentId &&
      !!scorekeeper.pin;

    if (hasActivePinSession || user?.isAnonymous) {
      setPinValidated(true);
    }
  }, [
    scorekeeper.active,
    scorekeeper.pin,
    scorekeeper.tournamentId,
    tournamentId,
    user?.isAnonymous,
  ]);

  useEffect(() => {
    if (!tournamentId || !matchId) {
      setMatchLoading(false);
      return;
    }

    const unsubscribe = subscribeToMatch(
      tournamentId,
      matchId,
      (nextMatch) => {
        setMatch(nextMatch);
        setMatchLoading(false);
      },
      (message) => {
        setMatchError(message);
        setMatchLoading(false);
      },
    );

    return unsubscribe;
  }, [matchId, tournamentId]);

  const { index: activeGameIndex, game: activeGame } = useMemo(
    () => getCurrentGame(match),
    [match],
  );

  const gamesToWin = useMemo(
    () => (tournament ? gamesNeededToWinMatch(tournament.scoringRules.bestOf) : 2),
    [tournament],
  );

  const isDeuceState = useMemo(
    () =>
      tournament
        ? isDeuce(
            activeGame.p1Score,
            activeGame.p2Score,
            tournament.scoringRules,
          )
        : false,
    [activeGame, tournament],
  );

  const serviceCourt = useMemo<ServiceCourt | undefined>(() => {
    if (!activeServer || !match) return undefined;
    const serverScore =
      activeServer === "p1" ? activeGame.p1Score : activeGame.p2Score;
    return getServiceCourt(serverScore);
  }, [activeServer, activeGame, match]);

  // Determine if this is a doubles match
  const isDoubles = match ? isDoublesCategory(match.category) : false;

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const handleScoreChange = async (player: Player, delta: 1 | -1) => {
    if (!tournamentId || !match || !tournament) return;

    const result = applyScoreChange({
      match,
      rules: tournament.scoringRules,
      player,
      delta,
    });
    if (result.rejected) return;

    // Start match timer on first scoring point.
    if (!matchStartTime && delta === 1) {
      setMatchStartTime(Date.now());
    }

    // Persist game-level patch (score, server, side-swap, point history) first;
    // if the game completed we then write the full scores array (with new game
    // appended) via updateMatch so the next game is seeded in Firestore too.
    await updateScore(tournamentId, match.id, result.activeGameIndex, result.gamePatch);

    setHistory((prev) => [
      ...prev.slice(-4),
      { gameIndex: result.activeGameIndex, player, delta },
    ]);

    if (delta === 1) {
      setActiveServer(player);
    }

    if (result.gameWinner) {
      if (result.matchWinner) {
        const winnerId =
          result.matchWinner === "p1" ? match.player1Id : match.player2Id;
        setPendingWinnerId(winnerId);
        setShowCelebrationModal(true);
      }
      await updateMatch(tournamentId, match.id, {
        scores: result.scores,
        status: "live",
      });
    }

    // UI side-effects: surface whichever interval the engine decided to fire.
    if (result.intervalEvent === "mid-game") {
      setIntervalType("mid-game");
      setIntervalMessage(undefined);
    } else if (result.intervalEvent === "change-ends") {
      setIntervalType("change-ends");
      setIntervalMessage(
        "Change ends at 11 in the deciding game. Players also take a 60-second interval.",
      );
    } else if (result.intervalEvent === "between-games") {
      setIntervalType("between-games");
      setIntervalMessage(
        "Game complete. Players change ends and take a 2-minute interval.",
      );
    }
  };

  const handleUndo = async () => {
    const last = history[history.length - 1];
    if (!last || !tournamentId || !match) return;

    const reverseDelta = (last.delta * -1) as 1 | -1;
    const updatedScores = match.scores.slice(0, last.gameIndex + 1);
    const targetGame = updatedScores[last.gameIndex];
    if (!targetGame) return;

    updatedScores[last.gameIndex] = {
      ...targetGame,
      p1Score:
        last.player === "p1"
          ? Math.max(0, targetGame.p1Score + reverseDelta)
          : targetGame.p1Score,
      p2Score:
        last.player === "p2"
          ? Math.max(0, targetGame.p2Score + reverseDelta)
          : targetGame.p2Score,
      winner: null,
      endedAt: null,
      pointHistory: (targetGame.pointHistory ?? []).slice(0, -1),
    };

    if (pendingWinnerId) {
      setPendingWinnerId(null);
    }

    await updateMatch(tournamentId, match.id, {
      scores: updatedScores,
      status: "live",
    });
    setHistory((prev) => prev.slice(0, -1));
  };

  const handleValidatePin = async () => {
    if (!tournament) return;
    setPinError(null);
    try {
      if (!pinInput || pinInput.length !== 4) {
        setPinError("Please enter a 4-digit PIN.");
        return;
      }
      await activateScorekeeperSession(pinInput, tournament.id);
      setPinValidated(true);
    } catch (value) {
      const message = value instanceof Error ? value.message : "Unknown error";
      if (message === "Invalid PIN") {
        setPinError(
          "Incorrect PIN. Please check the 4-digit venue PIN and try again.",
        );
      } else {
        setPinError(`Error activating session: ${message}`);
      }
    }
  };

  const handleCompleteMatch = () => {
    if (!tournamentId || !match || !pendingWinnerId) return;
    setShowEndMatchModal(true);
  };

  const handleConfirmEndMatch = async () => {
    if (!tournamentId || !match || !pendingWinnerId) return;
    await completeMatch(
      tournamentId,
      match.id,
      pendingWinnerId,
      match.nextMatchId,
    );
    setPendingWinnerId(null);
    setShowEndMatchModal(false);

    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/");
    }
  };

  const handleDismissInterval = useCallback(() => {
    setIntervalType(null);
    setIntervalMessage(undefined);
  }, []);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  if (matchLoading || tournamentLoading) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator size="large" />
      </SafeAreaView>
    );
  }

  if (!tournamentId) {
    return (
      <SafeAreaView style={styles.centered}>
        <Text style={styles.errorText}>
          Missing tournamentId in route params.
        </Text>
      </SafeAreaView>
    );
  }

  if (!match || !tournament) {
    return (
      <SafeAreaView style={styles.centered}>
        <Text style={styles.errorText}>
          {matchError ?? "Match or tournament not found."}
        </Text>
      </SafeAreaView>
    );
  }

  // PIN gate
  if (!pinValidated) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.pinContainer}>
          <AppCard style={styles.pinCard}>
            <Text style={styles.pinTitle}>Enter Venue PIN</Text>
            {pinError ? (
              <Text style={styles.errorBanner}>{pinError}</Text>
            ) : null}
            <AppInput
              label="Venue PIN"
              value={pinInput}
              onChangeText={(text) => {
                setPinInput(text);
                if (pinError) setPinError(null);
              }}
              maxLength={4}
              keyboardType="number-pad"
              placeholder="4-digit PIN"
            />
            <AppButton label="Unlock Score Entry" onPress={handleValidatePin} />
          </AppCard>
        </View>
      </SafeAreaView>
    );
  }

  const winnerName =
    pendingWinnerId === match.player1Id ? match.player1Name : match.player2Name;

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header — match info + game scores + timer */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View style={styles.headerInfo}>
            <Text style={styles.headerTitle}>
              {toCategoryLabel(match.category)} · {toRoundLabel(match.round)}
            </Text>
            <Text style={styles.headerSubTitle}>
              {typeof match.courtNumber === "number"
                ? `Court ${match.courtNumber}`
                : "Court TBD"}
            </Text>
          </View>
          {matchStartTime ? (
            <View style={styles.timerBadge}>
              <Text style={styles.timerText}>{formatElapsed(elapsed)}</Text>
            </View>
          ) : null}
        </View>
        <GameScoreBar
          scores={match.scores}
          activeGameIndex={activeGameIndex}
          gamesToWin={gamesToWin}
        />
      </View>

      {/* Score cards — fill remaining viewport, no scrolling */}
      <View style={styles.scoreArea}>
        <View style={styles.scoreGrid}>
          <ScoreInput
            label={match.player1Name}
            partnerLabel={isDoubles ? match.partner1Name : undefined}
            score={activeGame.p1Score}
            onTapCard={() => void handleScoreChange("p1", 1)}
            onIncrease={() => void handleScoreChange("p1", 1)}
            disabled={!!pendingWinnerId || activeGame.winner !== null}
            isServing={activeServer === "p1"}
            onSetServer={() => setActiveServer("p1")}
            serviceCourt={activeServer === "p1" ? serviceCourt : undefined}
            isDeuce={isDeuceState}
          />
          <ScoreInput
            label={match.player2Name}
            partnerLabel={isDoubles ? match.partner2Name : undefined}
            score={activeGame.p2Score}
            onTapCard={() => void handleScoreChange("p2", 1)}
            onIncrease={() => void handleScoreChange("p2", 1)}
            disabled={!!pendingWinnerId || activeGame.winner !== null}
            isServing={activeServer === "p2"}
            onSetServer={() => setActiveServer("p2")}
            serviceCourt={activeServer === "p2" ? serviceCourt : undefined}
            isDeuce={isDeuceState}
          />
        </View>
      </View>

      {/* Fixed bottom bar — undo + end match */}
      <View style={styles.bottomBar}>
        {pendingWinnerId ? (
          <AppButton
            label="End Match"
            onPress={handleCompleteMatch}
            style={styles.bottomButton}
          />
        ) : null}
        <AppButton
          label="Undo"
          variant="secondary"
          disabled={history.length === 0}
          onPress={() => void handleUndo()}
          style={[
            styles.bottomButtonSmall,
            history.length === 0 && styles.bottomButtonDisabled,
          ]}
          labelStyle={styles.undoLabel}
        />
      </View>

      {/* BWF Interval Timer */}
      <IntervalTimer
        visible={intervalType !== null}
        type={intervalType ?? "mid-game"}
        durationSeconds={intervalType === "between-games" ? 120 : 60}
        onDismiss={handleDismissInterval}
        message={intervalMessage}
      />

      {/* Celebration modal */}
      <Modal
        visible={showCelebrationModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCelebrationModal(false)}
      >
        <View style={[styles.modalOverlay, styles.celebrationOverlay]}>
          <Text style={styles.celebrationEmoji}>🏆</Text>
          <Text style={styles.celebrationTitle}>Match Complete!</Text>
          <Text style={styles.celebrationMessage}>
            {winnerName} has won the match.
          </Text>
          <View style={styles.modalActions}>
            <AppButton
              variant="secondary"
              label="Undo Last Point"
              onPress={() => {
                setShowCelebrationModal(false);
                void handleUndo();
              }}
              style={styles.flex1}
            />
            <AppButton
              label="End Match"
              onPress={() => {
                setShowCelebrationModal(false);
                handleCompleteMatch();
              }}
              style={styles.flex1}
            />
          </View>
        </View>
      </Modal>

      {/* End match confirmation */}
      <Modal
        visible={showEndMatchModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowEndMatchModal(false)}
      >
        <View style={styles.modalOverlay}>
          <AppCard style={styles.modalCard}>
            <Text style={styles.modalTitle}>End Match?</Text>
            <Text style={styles.modalMessage}>
              Confirm the final result. This will lock the match and update the
              bracket.
            </Text>
            <View style={styles.modalActions}>
              <AppButton
                variant="secondary"
                label="Cancel"
                onPress={() => setShowEndMatchModal(false)}
                style={styles.flex1}
              />
              <AppButton
                label="Confirm"
                onPress={() => void handleConfirmEndMatch()}
                style={styles.flex1}
              />
            </View>
          </AppCard>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.surfaceInverse, // ink-black scorekeeper
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.xl,
    backgroundColor: theme.colors.surfaceInverse,
  },
  errorText: {
    color: theme.colors.danger,
    fontWeight: '700',
  },
  errorBanner: {
    color: theme.colors.danger,
    backgroundColor: theme.colors.dangerSoft,
    borderLeftWidth: 3,
    borderLeftColor: theme.colors.danger,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontWeight: '700',
    fontSize: 13,
  },

  header: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: 12,
    paddingBottom: 12,
    backgroundColor: theme.colors.surfaceInverse,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
    gap: 8,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerInfo: {
    flex: 1,
    gap: 2,
  },
  headerTitle: {
    color: theme.colors.textInverse,
    fontWeight: '900',
    fontSize: 15,
    letterSpacing: -0.2,
  },
  headerSubTitle: {
    color: 'rgba(255,255,255,0.6)',
    fontWeight: '600',
    fontSize: 12,
    letterSpacing: 0.2,
  },
  timerBadge: {
    backgroundColor: theme.colors.live,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: theme.radius.full,
  },
  timerText: {
    color: theme.colors.textInverse,
    fontWeight: '900',
    fontSize: 14,
    fontVariant: ['tabular-nums'],
    letterSpacing: 1,
  },

  scoreArea: {
    flex: 1,
    padding: theme.spacing.md,
    backgroundColor: theme.colors.surfaceInverse,
  },
  scoreGrid: {
    flex: 1,
    flexDirection: 'row',
    gap: 10,
  },

  bottomBar: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: 12,
    paddingBottom: 18,
    backgroundColor: theme.colors.surfaceInverse,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  bottomButton: { flex: 1 },
  bottomButtonSmall: {
    minWidth: 80,
    flex: 0,
    paddingHorizontal: 20,
  },
  bottomButtonDisabled: { opacity: 0.35 },
  undoLabel: {
    color: theme.colors.text,
    fontWeight: '800',
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(17,17,17,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.xl,
  },
  celebrationOverlay: {
    backgroundColor: 'rgba(17,17,17,0.95)',
  },
  celebrationEmoji: {
    fontSize: 72,
    marginBottom: 12,
  },
  celebrationTitle: {
    color: theme.colors.textInverse,
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: -1,
    textAlign: 'center',
  },
  celebrationMessage: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 16,
    fontWeight: '500',
    textAlign: 'center',
    marginBottom: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 400,
    gap: 16,
    padding: theme.spacing.xl,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  modalTitle: {
    fontSize: 26,
    fontWeight: '900',
    color: theme.colors.text,
    letterSpacing: -0.5,
  },
  modalMessage: {
    fontSize: 14,
    color: theme.colors.textMuted,
    lineHeight: 20,
    fontWeight: '500',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
    width: '100%',
    maxWidth: 400,
  },
  flex1: { flex: 1 },

  pinContainer: {
    flex: 1,
    justifyContent: 'center',
    padding: theme.spacing.lg,
    backgroundColor: theme.colors.background,
  },
  pinCard: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1.5,
    borderColor: theme.colors.text,
    padding: theme.spacing.xl,
    gap: 12,
  },
  pinTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: theme.colors.text,
    letterSpacing: -0.5,
  },
});
