import { router } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

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

  // Refresh recovery: if there's no match in store, send back to setup.
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
    <View style={styles.root}>
      <View style={styles.topbar}>
        <Pressable onPress={() => { reset(); router.replace('/quick'); }}>
          <Text style={styles.topbarLink}>‹ Exit</Text>
        </Pressable>
        <Text style={styles.topbarMeta}>{formatLabel} · {rulesLabel}</Text>
        <View style={{ width: 50 }} />
      </View>

      {isOver ? (
        <View style={styles.completeWrap}>
          <Text style={styles.trophy}>🏆</Text>
          <Text style={styles.completeTitle}>{winnerName} wins!</Text>
          <Text style={styles.completeSub}>
            Best of {match.rules.bestOf} — {aGameWins}-{bGameWins}
          </Text>
          <View style={styles.scoreSummary}>
            {match.completedGames.map((g, i) => (
              <Text key={i} style={styles.scoreLine}>
                Game {i + 1}: {g.a}–{g.b}
              </Text>
            ))}
          </View>
          <View style={styles.completeButtons}>
            <Pressable style={[styles.btn, styles.btnPrimary]} onPress={rematch}>
              <Text style={styles.btnPrimaryText}>Rematch</Text>
            </Pressable>
            <Pressable
              style={[styles.btn, styles.btnSecondary]}
              onPress={() => { reset(); router.replace('/quick'); }}
            >
              <Text style={styles.btnSecondaryText}>New match</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <>
          <View style={styles.scoreRow}>
            <Pressable
              style={[styles.side, styles.sideA, server === 'A' && styles.sideServing]}
              onPress={() => scorePoint('A')}
            >
              <Text style={styles.sideName}>{match.sideAName}</Text>
              <Text style={styles.sideScore}>{match.currentGame.a}</Text>
              <Text style={styles.sideHint}>Tap to add point</Text>
              <Text style={styles.gamesWon}>{aGameWins} / {need}</Text>
            </Pressable>
            <Pressable
              style={[styles.side, styles.sideB, server === 'B' && styles.sideServing]}
              onPress={() => scorePoint('B')}
            >
              <Text style={styles.sideName}>{match.sideBName}</Text>
              <Text style={styles.sideScore}>{match.currentGame.b}</Text>
              <Text style={styles.sideHint}>Tap to add point</Text>
              <Text style={styles.gamesWon}>{bGameWins} / {need}</Text>
            </Pressable>
          </View>

          <View style={styles.bottomBar}>
            <Pressable
              onPress={undo}
              disabled={match.history.length === 0}
              style={[styles.undoBtn, match.history.length === 0 && styles.undoBtnDim]}
            >
              <Text style={styles.undoBtnText}>↶ Undo</Text>
            </Pressable>
            <View style={styles.completedGamesWrap}>
              {match.completedGames.length > 0 && (
                <Text style={styles.completedGamesText}>
                  {match.completedGames.map((g, i) => `${g.a}–${g.b}`).join('  ·  ')}
                </Text>
              )}
            </View>
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0B1120' },
  topbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: 28,
  },
  topbarLink: { color: '#3B82F6', fontSize: 15, fontWeight: '600', width: 50 },
  topbarMeta: { color: '#94A3B8', fontSize: 12 },
  scoreRow: { flex: 1, flexDirection: 'row' },
  side: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    gap: 12,
  },
  sideA: { backgroundColor: '#0F172A' },
  sideB: { backgroundColor: '#172033' },
  sideServing: { borderTopWidth: 4, borderTopColor: '#3B82F6' },
  sideName: { color: '#94A3B8', fontSize: 18, fontWeight: '600', textAlign: 'center' },
  sideScore: { color: '#F8FAFC', fontSize: 144, fontWeight: '900' },
  sideHint: { color: '#475569', fontSize: 13 },
  gamesWon: { color: '#64748B', fontSize: 13, marginTop: 8 },
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  undoBtn: { backgroundColor: '#1E293B', paddingVertical: 10, paddingHorizontal: 18, borderRadius: 8 },
  undoBtnDim: { opacity: 0.4 },
  undoBtnText: { color: '#F8FAFC', fontSize: 14, fontWeight: '600' },
  completedGamesWrap: { flex: 1 },
  completedGamesText: { color: '#94A3B8', fontSize: 13, textAlign: 'right' },
  completeWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 8 },
  trophy: { fontSize: 64 },
  completeTitle: { color: '#F8FAFC', fontSize: 32, fontWeight: '800', textAlign: 'center' },
  completeSub: { color: '#94A3B8', fontSize: 16 },
  scoreSummary: { marginTop: 16, gap: 4 },
  scoreLine: { color: '#CBD5E1', fontSize: 15, textAlign: 'center' },
  completeButtons: { flexDirection: 'row', gap: 12, marginTop: 24 },
  btn: { paddingVertical: 14, paddingHorizontal: 24, borderRadius: 10 },
  btnPrimary: { backgroundColor: '#3B82F6' },
  btnPrimaryText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  btnSecondary: { backgroundColor: '#1E293B' },
  btnSecondaryText: { color: '#F8FAFC', fontSize: 15, fontWeight: '600' },
});
