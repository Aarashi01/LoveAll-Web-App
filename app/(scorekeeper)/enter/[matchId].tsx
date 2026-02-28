import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View
} from 'react-native';

import { ScoreInput } from '@/components/score/ScoreInput';
import { AppButton } from '@/components/ui/AppButton';
import { AppCard } from '@/components/ui/AppCard';
import { AppInput } from '@/components/ui/AppInput';
import { theme, toCategoryLabel, toRoundLabel } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { useTournament } from '@/hooks/useTournament';
import { completeMatch, subscribeToMatch, updateMatch, updateScore } from '@/lib/firestore/matches';
import { type MatchDocument, type ScoreGame, type ScoringRules } from '@/lib/firestore/types';
import { activateScorekeeperSession } from '@/lib/scorekeeper-session';
import { useAppStore } from '@/store/app.store';

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

export default function ScoreEntryScreen() {
  const { matchId, tournamentId } = useLocalSearchParams<{ matchId: string; tournamentId?: string }>();
  const { user } = useAuth();
  const { tournament, loading: tournamentLoading } = useTournament(tournamentId);
  const scorekeeper = useAppStore((state) => state.scorekeeper);

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

  const gameHistory = useMemo(
    () =>
      (match?.scores ?? [])
        .filter((score) => score.winner !== null)
        .map((score) => `${score.p1Score}-${score.p2Score}`)
        .join(', '),
    [match],
  );

  const handleScoreChange = async (player: 'p1' | 'p2', delta: 1 | -1) => {
    if (!tournamentId || !match || !tournament) return;

    const nextP1 = player === 'p1' ? activeGame.p1Score + delta : activeGame.p1Score;
    const nextP2 = player === 'p2' ? activeGame.p2Score + delta : activeGame.p2Score;

    if (nextP1 < 0 || nextP2 < 0) return;

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
    setHistory((prev) => [
      ...prev.slice(-4),
      { gameIndex: activeGameIndex, player, delta },
    ]);

    if (delta === 1) {
      setActiveServer(player);
    }

    if (delta === -1) return;

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
    const gamesToWin = Math.ceil(tournament.scoringRules.bestOf / 2);
    const matchWinnerId =
      wins.p1 >= gamesToWin ? match.player1Id : wins.p2 >= gamesToWin ? match.player2Id : null;

    if (matchWinnerId) {
      setPendingWinnerId(matchWinnerId);
      setShowCelebrationModal(true);
      await updateMatch(tournamentId, match.id, { scores: updatedScores, status: 'live' });
      return;
    }

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
  };

  const handleUndo = async () => {
    const last = history[history.length - 1];
    if (!last || !tournamentId || !match) return;

    const reverseDelta = (last.delta * -1) as 1 | -1;

    // Slice off any newly created blank games that occurred after the game we are undoing
    const updatedScores = match.scores.slice(0, last.gameIndex + 1);

    // Apply the reversed score to the targeted game
    const targetGame = updatedScores[last.gameIndex];
    if (!targetGame) return;

    updatedScores[last.gameIndex] = {
      ...targetGame,
      p1Score: last.player === 'p1' ? Math.max(0, targetGame.p1Score + reverseDelta) : targetGame.p1Score,
      p2Score: last.player === 'p2' ? Math.max(0, targetGame.p2Score + reverseDelta) : targetGame.p2Score,
      winner: null, // Always clear the winner flag if we are undoing a point
      endedAt: null,
    };

    if (pendingWinnerId) {
      setPendingWinnerId(null);
    }

    // Use updateMatch to apply the fully reconstructed scores array (removes extra games + clears winner)
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

    // Attempt to route back nicely, which returns the user to the schedule or bracket
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/');
    }
  };

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

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>
          {toCategoryLabel(match.category)} - {toRoundLabel(match.round)}
        </Text>
        <Text style={styles.headerSubTitle}>
          {typeof match.courtNumber === 'number' ? `Court ${match.courtNumber}` : 'Court TBD'}
        </Text>
      </View>

      {!pinValidated ? (
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
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.historyText}>Game history: {gameHistory || 'No completed games yet'}</Text>

          <View style={styles.scoreGrid}>
            <ScoreInput
              label={match.player1Name}
              score={activeGame.p1Score}
              isServing={activeServer === 'p1' || activeGame.currentServer === 'p1'}
              onTapCard={() => void handleScoreChange('p1', 1)}
              onIncrease={() => void handleScoreChange('p1', 1)}
              disabled={!!pendingWinnerId || activeGame.winner !== null}
              onSetServer={() => setActiveServer('p1')}
            />
            <ScoreInput
              label={match.player2Name}
              score={activeGame.p2Score}
              isServing={activeServer === 'p2' || activeGame.currentServer === 'p2'}
              onTapCard={() => void handleScoreChange('p2', 1)}
              onIncrease={() => void handleScoreChange('p2', 1)}
              disabled={!!pendingWinnerId || activeGame.winner !== null}
              onSetServer={() => setActiveServer('p2')}
            />
          </View>

          {pendingWinnerId ? (
            <AppButton label="End Match" onPress={handleCompleteMatch} />
          ) : null}
        </ScrollView>
      )}

      <AppButton
        label="Undo"
        variant="secondary"
        style={[styles.undoFab, history.length === 0 && styles.undoFabDisabled]}
        labelStyle={styles.undoLabel}
        disabled={history.length === 0}
        onPress={() => void handleUndo()}
      />

      <Modal
        visible={showCelebrationModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCelebrationModal(false)}
      >
        <View style={[styles.modalOverlay, { backgroundColor: 'rgba(15, 23, 42, 0.95)' }]}>
          <Text style={{ fontSize: 80, marginBottom: 20 }}>🏆</Text>
          <Text style={[styles.modalTitle, { color: '#F8FAFC', fontSize: 32, textAlign: 'center' }]}>
            Match Complete!
          </Text>
          <Text style={[styles.modalMessage, { color: '#94A3B8', fontSize: 18, textAlign: 'center', marginBottom: 24 }]}>
            {pendingWinnerId === match.player1Id ? match.player1Name : match.player2Name} has won the match.
          </Text>
          <View style={[styles.modalActions, { width: '100%', maxWidth: 400 }]}>
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

      <Modal
        visible={showEndMatchModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowEndMatchModal(false)}
      >
        <View style={styles.modalOverlay}>
          <AppCard style={styles.modalCard}>
            <Text style={styles.modalTitle}>End Match?</Text>
            <Text style={styles.modalMessage}>Confirm the final result. This will lock the match and update the bracket.</Text>
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
  header: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#0B1220',
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  headerTitle: {
    color: '#E2E8F0',
    fontWeight: '800',
    fontSize: 18,
  },
  headerSubTitle: {
    color: '#94A3B8',
    fontWeight: '600',
    marginTop: 2,
  },
  content: {
    padding: 16,
    paddingBottom: 120,
    gap: 14,
  },
  historyText: {
    color: '#334155',
    fontWeight: '600',
    fontSize: 14,
  },
  scoreGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  undoFab: {
    position: 'absolute',
    right: 18,
    bottom: 18,
    borderRadius: 999,
    minWidth: 84,
    minHeight: 48,
    paddingHorizontal: 20,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderWidth: 1,
  },
  undoFabDisabled: {
    opacity: 0.35,
  },
  undoLabel: {
    color: theme.colors.text,
    fontWeight: '800',
  },
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
  },
  flex1: {
    flex: 1,
  },
  pinContainer: {
    margin: 16,
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
