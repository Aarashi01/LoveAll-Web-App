import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';

import { ScoreInput } from '@/components/score/ScoreInput';
import { useAuth } from '@/hooks/useAuth';
import { activateScorekeeperSession } from '@/lib/scorekeeper-session';
import { useTournament } from '@/hooks/useTournament';
import { completeMatch, subscribeToMatch, updateMatch, updateScore } from '@/lib/firestore/matches';
import { type MatchDocument, type ScoringRules, type ScoreGame } from '@/lib/firestore/types';
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
  const [pinValidated, setPinValidated] = useState(false);
  const [history, setHistory] = useState<ScoreAction[]>([]);
  const [pendingWinnerId, setPendingWinnerId] = useState<string | null>(null);

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

    await updateScore(tournamentId, match.id, activeGameIndex, player, delta);
    setHistory((prev) => [...prev.slice(-4), { gameIndex: activeGameIndex, player, delta }]);

    if (delta === -1) return;

    const winner = getGameWinner(nextP1, nextP2, tournament.scoringRules);
    if (!winner) return;

    const updatedScores = [...match.scores];
    updatedScores[activeGameIndex] = {
      ...updatedScores[activeGameIndex],
      p1Score: nextP1,
      p2Score: nextP2,
      winner,
    };

    const wins = countWins(updatedScores);
    const gamesToWin = Math.ceil(tournament.scoringRules.bestOf / 2);
    const matchWinnerId =
      wins.p1 >= gamesToWin ? match.player1Id : wins.p2 >= gamesToWin ? match.player2Id : null;

    if (matchWinnerId) {
      setPendingWinnerId(matchWinnerId);
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
    await updateScore(tournamentId, match.id, last.gameIndex, last.player, reverseDelta);
    setHistory((prev) => prev.slice(0, -1));
  };

  const handleValidatePin = async () => {
    if (!tournament) return;
    try {
      await activateScorekeeperSession(pinInput, tournament);
      setPinValidated(true);
    } catch {
      Alert.alert('Invalid PIN', 'Please check the 4-digit venue PIN and try again.');
    }
  };

  const handleCompleteMatch = async () => {
    if (!tournamentId || !match || !pendingWinnerId) return;

    Alert.alert('End match?', 'Confirm final result and lock this match as completed.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Confirm',
        style: 'default',
        onPress: async () => {
          await completeMatch(tournamentId, match.id, pendingWinnerId, match.nextMatchId);
          setPendingWinnerId(null);
        },
      },
    ]);
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
          {match.category} - {match.round}
        </Text>
        <Text style={styles.headerSubTitle}>
          {typeof match.courtNumber === 'number' ? `Court ${match.courtNumber}` : 'Court TBD'}
        </Text>
      </View>

      {!pinValidated ? (
        <View style={styles.pinContainer}>
          <Text style={styles.pinTitle}>Enter Venue PIN</Text>
          <TextInput
            value={pinInput}
            onChangeText={setPinInput}
            maxLength={4}
            keyboardType="number-pad"
            placeholder="4-digit PIN"
            style={styles.pinInput}
          />
          <Pressable style={styles.pinButton} onPress={handleValidatePin}>
            <Text style={styles.pinButtonLabel}>Unlock Score Entry</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.historyText}>Game history: {gameHistory || 'No completed games yet'}</Text>

          <View style={styles.scoreGrid}>
            <ScoreInput
              label={match.player1Name}
              score={activeGame.p1Score}
              onTapCard={() => void handleScoreChange('p1', 1)}
              onIncrease={() => void handleScoreChange('p1', 1)}
              onDecrease={() => void handleScoreChange('p1', -1)}
            />
            <ScoreInput
              label={match.player2Name}
              score={activeGame.p2Score}
              onTapCard={() => void handleScoreChange('p2', 1)}
              onIncrease={() => void handleScoreChange('p2', 1)}
              onDecrease={() => void handleScoreChange('p2', -1)}
            />
          </View>

          {pendingWinnerId ? (
            <Pressable style={styles.completeButton} onPress={handleCompleteMatch}>
              <Text style={styles.completeButtonLabel}>End Match</Text>
            </Pressable>
          ) : null}
        </ScrollView>
      )}

      <Pressable
        style={[styles.undoFab, history.length === 0 && styles.undoFabDisabled]}
        disabled={history.length === 0}
        onPress={() => void handleUndo()}
      >
        <Text style={styles.undoLabel}>Undo</Text>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F1F5F9',
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
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#0F172A',
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
  completeButton: {
    backgroundColor: '#1D4ED8',
    minHeight: 52,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  completeButtonLabel: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 18,
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
    backgroundColor: '#0F172A',
  },
  undoFabDisabled: {
    opacity: 0.35,
  },
  undoLabel: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  pinContainer: {
    margin: 16,
    padding: 18,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    gap: 12,
  },
  pinTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
  },
  pinInput: {
    borderWidth: 1,
    borderColor: '#94A3B8',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: '#F8FAFC',
    fontSize: 18,
    letterSpacing: 2,
  },
  pinButton: {
    backgroundColor: '#166534',
    borderRadius: 10,
    minHeight: 46,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pinButtonLabel: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
});
