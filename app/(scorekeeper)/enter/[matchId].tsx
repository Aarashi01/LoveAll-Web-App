import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions
} from 'react-native';

import { GameScoreBar } from '@/components/score/GameScoreBar';
import { IntervalTimer } from '@/components/score/IntervalTimer';
import { ScoreInput } from '@/components/score/ScoreInput';
import { AppButton } from '@/components/ui/AppButton';
import { AppCard } from '@/components/ui/AppCard';
import { AppInput } from '@/components/ui/AppInput';
import { theme, toCategoryLabel, toRoundLabel } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { useTournament } from '@/hooks/useTournament';
import { completeMatch, subscribeToMatch, updateMatch, updateScore } from '@/lib/firestore/matches';
import { type MatchDocument, type ScoreGame, type ScoringRules, type ServiceCourt } from '@/lib/firestore/types';
import { activateScorekeeperSession } from '@/lib/scorekeeper-session';
import { useAppStore } from '@/store/app.store';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type ScoreAction = {
  gameIndex: number;
  player: 'p1' | 'p2';
  delta: 1 | -1;
};

function getCurrentGame(match: MatchDocument | null): { index: number; game: ScoreGame } {
  if (!match || match.scores.length === 0) {
    return {
      index: 0,
      game: { gameNumber: 1, p1Score: 0, p2Score: 0, winner: null, startedAt: null, endedAt: null },
    };
  }

  const openIndex = match.scores.findIndex((score) => score.winner === null);
  const index = openIndex === -1 ? match.scores.length - 1 : openIndex;
  return { index, game: match.scores[index] };
}

function getGameWinner(p1Score: number, p2Score: number, rules: ScoringRules): 'p1' | 'p2' | null {
  const high = Math.max(p1Score, p2Score);
  const low = Math.min(p1Score, p2Score);
  const diff = high - low;

  if (!rules.deuceEnabled) {
    if (p1Score >= rules.pointsPerGame) return 'p1';
    if (p2Score >= rules.pointsPerGame) return 'p2';
    return null;
  }

  if (high >= rules.maxPoints) return p1Score > p2Score ? 'p1' : 'p2';
  if (high >= rules.pointsPerGame && diff >= rules.clearBy) return p1Score > p2Score ? 'p1' : 'p2';
  return null;
}

function countWins(scores: ScoreGame[]): { p1: number; p2: number } {
  return scores.reduce(
    (acc, score) => {
      if (score.winner === 'p1') acc.p1 += 1;
      if (score.winner === 'p2') acc.p2 += 1;
      return acc;
    },
    { p1: 0, p2: 0 },
  );
}

/**
 * BWF service court: right when server's score is even, left when odd.
 */
function getServiceCourt(serverScore: number): ServiceCourt {
  return serverScore % 2 === 0 ? 'right' : 'left';
}

/**
 * Check if a mid-game interval should trigger:
 * BWF Law says interval at leading score = 11.
 */
function shouldTriggerMidGameInterval(
  p1Score: number,
  p2Score: number,
  prevP1: number,
  prevP2: number,
): boolean {
  const leadingScore = Math.max(p1Score, p2Score);
  const prevLeading = Math.max(prevP1, prevP2);
  return leadingScore >= 11 && prevLeading < 11;
}

/**
 * Check if change-of-ends should happen (at 11 in game 3).
 */
function shouldTriggerChangeOfEnds(
  gameNumber: number,
  bestOf: number,
  p1Score: number,
  p2Score: number,
  prevP1: number,
  prevP2: number,
): boolean {
  if (gameNumber !== bestOf) return false; // Only in the deciding game
  const leadingScore = Math.max(p1Score, p2Score);
  const prevLeading = Math.max(prevP1, prevP2);
  return leadingScore >= 11 && prevLeading < 11;
}

function isDeuce(p1Score: number, p2Score: number, rules: ScoringRules): boolean {
  return (
    rules.deuceEnabled &&
    p1Score >= rules.deuceAt &&
    p2Score >= rules.deuceAt &&
    p1Score < rules.maxPoints &&
    p2Score < rules.maxPoints
  );
}

function formatElapsed(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function isDoublesCategory(category: string): boolean {
  return category === 'MD' || category === 'WD' || category === 'XD';
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ScoreEntryScreen() {
  const { matchId, tournamentId } = useLocalSearchParams<{ matchId: string; tournamentId?: string }>();
  const { user } = useAuth();
  const { tournament, loading: tournamentLoading } = useTournament(tournamentId);
  const scorekeeper = useAppStore((state) => state.scorekeeper);
  const { height: windowHeight } = useWindowDimensions();

  const [match, setMatch] = useState<MatchDocument | null>(null);
  const [matchLoading, setMatchLoading] = useState(true);
  const [matchError, setMatchError] = useState<string | null>(null);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);
  const [pinValidated, setPinValidated] = useState(false);
  const [history, setHistory] = useState<ScoreAction[]>([]);
  const [pendingWinnerId, setPendingWinnerId] = useState<string | null>(null);
  const [showEndMatchModal, setShowEndMatchModal] = useState(false);
  const [showCelebrationModal, setShowCelebrationModal] = useState(false);
  const [activeServer, setActiveServer] = useState<'p1' | 'p2' | null>(null);

  // BWF interval state
  const [intervalType, setIntervalType] = useState<'mid-game' | 'between-games' | 'change-ends' | null>(null);
  const [intervalMessage, setIntervalMessage] = useState<string | undefined>(undefined);

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
  }, [scorekeeper.active, scorekeeper.pin, scorekeeper.tournamentId, tournamentId, user?.isAnonymous]);

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

  const { index: activeGameIndex, game: activeGame } = useMemo(() => getCurrentGame(match), [match]);

  const gamesToWin = useMemo(
    () => (tournament ? Math.ceil(tournament.scoringRules.bestOf / 2) : 2),
    [tournament],
  );

  const isDeuceState = useMemo(
    () => (tournament ? isDeuce(activeGame.p1Score, activeGame.p2Score, tournament.scoringRules) : false),
    [activeGame, tournament],
  );

  const serviceCourt = useMemo<ServiceCourt | undefined>(() => {
    if (!activeServer || !match) return undefined;
    const serverScore = activeServer === 'p1' ? activeGame.p1Score : activeGame.p2Score;
    return getServiceCourt(serverScore);
  }, [activeServer, activeGame, match]);

  // Determine if this is a doubles match
  const isDoubles = match ? isDoublesCategory(match.category) : false;

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const handleScoreChange = async (player: 'p1' | 'p2', delta: 1 | -1) => {
    if (!tournamentId || !match || !tournament) return;

    const prevP1 = activeGame.p1Score;
    const prevP2 = activeGame.p2Score;
    const nextP1 = player === 'p1' ? prevP1 + delta : prevP1;
    const nextP2 = player === 'p2' ? prevP2 + delta : prevP2;

    if (nextP1 < 0 || nextP2 < 0) return;

    // Start match timer on first point
    if (!matchStartTime && delta === 1) {
      setMatchStartTime(Date.now());
    }

    // Handle initial serve or keep current server if undefined
    let currentServer = activeGame.currentServer;
    if (!currentServer && delta === 1) {
      currentServer = player;
    }

    // Determine if service over happened
    let nextServer = currentServer;
    if (delta === 1 && currentServer && currentServer !== player) {
      nextServer = player;
    }

    // Determine if sides should be swapped
    let sidesSwapped = activeGame.sidesSwapped ?? false;
    const isFinalGame = activeGameIndex === tournament.scoringRules.bestOf - 1;
    const swapAt = tournament.scoringRules.pointsPerGame === 21 ? 11 : Math.ceil(tournament.scoringRules.pointsPerGame / 2);

    if (isFinalGame && !sidesSwapped && (nextP1 === swapAt || nextP2 === swapAt)) {
      sidesSwapped = true;
    }

    await updateScore(tournamentId, match.id, activeGameIndex, {
      p1Score: nextP1,
      p2Score: nextP2,
      currentServer: nextServer,
      sidesSwapped,
    });
    setHistory((prev) => [...prev.slice(-4), { gameIndex: activeGameIndex, player, delta }]);

    if (delta === 1) {
      setActiveServer(player);
    }

    if (delta === -1) return;

    // Check for mid-game interval at 11
    if (shouldTriggerMidGameInterval(nextP1, nextP2, prevP1, prevP2)) {
      setIntervalType('mid-game');
      setIntervalMessage(undefined);
    }

    // Check for change of ends at 11 in deciding game
    if (shouldTriggerChangeOfEnds(activeGame.gameNumber, tournament.scoringRules.bestOf, nextP1, nextP2, prevP1, prevP2)) {
      // This overlaps with mid-game interval — show change-ends instead since it's more important
      setIntervalType('change-ends');
      setIntervalMessage('Change ends at 11 in the deciding game. Players also take a 60-second interval.');
    }

    const winner = getGameWinner(nextP1, nextP2, tournament.scoringRules);
    if (!winner) return;

    const updatedScores = [...match.scores];
    updatedScores[activeGameIndex] = {
      ...updatedScores[activeGameIndex],
      p1Score: nextP1,
      p2Score: nextP2,
      currentServer: nextServer,
      sidesSwapped,
      winner,
    };

    const wins = countWins(updatedScores);
    const matchWinnerId =
      wins.p1 >= gamesToWin ? match.player1Id : wins.p2 >= gamesToWin ? match.player2Id : null;

    if (matchWinnerId) {
      setPendingWinnerId(matchWinnerId);
      setShowCelebrationModal(true);
      await updateMatch(tournamentId, match.id, { scores: updatedScores, status: 'live' });
      return;
    }

    // Start next game
    if (!updatedScores[activeGameIndex + 1]) {
      updatedScores.push({
        gameNumber: updatedScores.length + 1,
        p1Score: 0,
        p2Score: 0,
        winner: null,
        startedAt: null,
        endedAt: null,
      });
    }

    await updateMatch(tournamentId, match.id, { scores: updatedScores, status: 'live' });

    // Between-games interval + change of ends
    setIntervalType('between-games');
    setIntervalMessage('Game complete. Players change ends and take a 2-minute interval.');
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
      p1Score: last.player === 'p1' ? Math.max(0, targetGame.p1Score + reverseDelta) : targetGame.p1Score,
      p2Score: last.player === 'p2' ? Math.max(0, targetGame.p2Score + reverseDelta) : targetGame.p2Score,
      winner: null,
      endedAt: null,
    };

    if (pendingWinnerId) {
      setPendingWinnerId(null);
    }

    await updateMatch(tournamentId, match.id, { scores: updatedScores, status: 'live' });
    setHistory((prev) => prev.slice(0, -1));
  };

  const handleValidatePin = async () => {
    if (!tournament) return;
    setPinError(null);
    try {
      if (!pinInput || pinInput.length !== 4) {
        setPinError('Please enter a 4-digit PIN.');
        return;
      }
      await activateScorekeeperSession(pinInput, tournament);
      setPinValidated(true);
    } catch (value) {
      const message = value instanceof Error ? value.message : 'Unknown error';
      if (message === 'Invalid PIN') {
        setPinError('Incorrect PIN. Please check the 4-digit venue PIN and try again.');
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
    await completeMatch(tournamentId, match.id, pendingWinnerId, match.nextMatchId);
    setPendingWinnerId(null);
    setShowEndMatchModal(false);

    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/');
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
        <Text style={styles.errorText}>Missing tournamentId in route params.</Text>
      </SafeAreaView>
    );
  }

  if (!match || !tournament) {
    return (
      <SafeAreaView style={styles.centered}>
        <Text style={styles.errorText}>{matchError ?? 'Match or tournament not found.'}</Text>
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
            {pinError ? <Text style={styles.errorBanner}>{pinError}</Text> : null}
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
              {typeof match.courtNumber === 'number' ? `Court ${match.courtNumber}` : 'Court TBD'}
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
            onTapCard={() => void handleScoreChange('p1', 1)}
            onIncrease={() => void handleScoreChange('p1', 1)}
            disabled={!!pendingWinnerId || activeGame.winner !== null}
            isServing={activeServer === 'p1'}
            onSetServer={() => setActiveServer('p1')}
            serviceCourt={activeServer === 'p1' ? serviceCourt : undefined}
            isDeuce={isDeuceState}
          />
          <ScoreInput
            label={match.player2Name}
            partnerLabel={isDoubles ? match.partner2Name : undefined}
            score={activeGame.p2Score}
            onTapCard={() => void handleScoreChange('p2', 1)}
            onIncrease={() => void handleScoreChange('p2', 1)}
            disabled={!!pendingWinnerId || activeGame.winner !== null}
            isServing={activeServer === 'p2'}
            onSetServer={() => setActiveServer('p2')}
            serviceCourt={activeServer === 'p2' ? serviceCourt : undefined}
            isDeuce={isDeuceState}
          />
        </View>
      </View>

      {/* Fixed bottom bar — undo + end match */}
      <View style={styles.bottomBar}>
        {pendingWinnerId ? (
          <AppButton label="End Match" onPress={handleCompleteMatch} style={styles.bottomButton} />
        ) : null}
        <AppButton
          label="Undo"
          variant="secondary"
          disabled={history.length === 0}
          onPress={() => void handleUndo()}
          style={[styles.bottomButtonSmall, history.length === 0 && styles.bottomButtonDisabled]}
          labelStyle={styles.undoLabel}
        />
      </View>

      {/* BWF Interval Timer */}
      <IntervalTimer
        visible={intervalType !== null}
        type={intervalType ?? 'mid-game'}
        durationSeconds={intervalType === 'between-games' ? 120 : 60}
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
              Confirm the final result. This will lock the match and update the bracket.
            </Text>
            <View style={styles.modalActions}>
              <AppButton variant="secondary" label="Cancel" onPress={() => setShowEndMatchModal(false)} style={styles.flex1} />
              <AppButton label="Confirm" onPress={() => void handleConfirmEndMatch()} style={styles.flex1} />
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
    backgroundColor: theme.colors.background,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: theme.colors.background,
  },
  errorText: {
    color: '#B91C1C',
    fontWeight: '700',
  },
  errorBanner: {
    color: '#EF4444',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderColor: 'rgba(239, 68, 68, 0.3)',
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    fontWeight: '600',
    fontSize: 14,
  },

  // Header
  header: {
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 10,
    backgroundColor: 'rgba(11, 18, 32, 0.95)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
    gap: 8,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerInfo: {
    flex: 1,
    gap: 1,
  },
  headerTitle: {
    color: '#E2E8F0',
    fontWeight: '800',
    fontSize: 15,
    letterSpacing: 0.3,
  },
  headerSubTitle: {
    color: '#64748B',
    fontWeight: '600',
    fontSize: 13,
  },
  timerBadge: {
    backgroundColor: 'rgba(59, 130, 246, 0.12)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.3)',
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  timerText: {
    color: '#60A5FA',
    fontWeight: '900',
    fontSize: 16,
    fontVariant: ['tabular-nums'],
    letterSpacing: 1,
  },

  // Score area — fills remaining space
  scoreArea: {
    flex: 1,
    padding: 10,
  },
  scoreGrid: {
    flex: 1,
    flexDirection: 'row',
    gap: 10,
  },

  // Bottom bar — fixed to bottom
  bottomBar: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 16,
    backgroundColor: 'rgba(11, 18, 32, 0.95)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
    ...(typeof window !== 'undefined' && {
      backdropFilter: 'blur(16px)',
    }),
  },
  bottomButton: {
    flex: 1,
  },
  bottomButtonSmall: {
    minWidth: 80,
    flex: 0,
    paddingHorizontal: 20,
  },
  bottomButtonDisabled: {
    opacity: 0.35,
  },
  undoLabel: {
    color: theme.colors.text,
    fontWeight: '800',
  },

  // Modals
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    ...(typeof window !== 'undefined' && {
      backdropFilter: 'blur(4px)',
    }),
  },
  celebrationOverlay: {
    backgroundColor: 'rgba(15, 23, 42, 0.95)',
  },
  celebrationEmoji: {
    fontSize: 72,
    marginBottom: 12,
  },
  celebrationTitle: {
    color: '#F8FAFC',
    fontSize: 28,
    fontWeight: '900',
    textAlign: 'center',
  },
  celebrationMessage: {
    color: '#94A3B8',
    fontSize: 17,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 400,
    gap: 16,
    padding: 24,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: theme.colors.text,
  },
  modalMessage: {
    fontSize: 16,
    color: '#94A3B8',
    lineHeight: 24,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
    width: '100%',
    maxWidth: 400,
  },
  flex1: {
    flex: 1,
  },

  // PIN screen
  pinContainer: {
    flex: 1,
    justifyContent: 'center',
    padding: 16,
  },
  pinCard: {
    gap: 12,
  },
  pinTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: theme.colors.text,
  },
});
