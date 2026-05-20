import type {
  MatchDocument,
  ScoreGame,
  ScoringRules,
} from '@/lib/firestore/types';
import {
  applyScoreChange,
  countWins,
  gamesNeededToWinMatch,
  getCurrentGame,
  getGameWinner,
  getMatchWinner,
  getServiceCourt,
  getSideSwapPoint,
  isDeuce,
  shouldSwapSides,
  shouldTriggerChangeOfEnds,
  shouldTriggerMidGameInterval,
} from '@/lib/tournament-match-engine';

const RULES_21_DEUCE: ScoringRules = {
  bestOf: 1,
  pointsPerGame: 21,
  deuceEnabled: true,
  deuceAt: 20,
  clearBy: 2,
  maxPoints: 30,
};

const RULES_21_BO3: ScoringRules = { ...RULES_21_DEUCE, bestOf: 3 };

const RULES_21_NO_DEUCE: ScoringRules = {
  ...RULES_21_DEUCE,
  deuceEnabled: false,
};

const RULES_11_BO1_NO_DEUCE: ScoringRules = {
  bestOf: 1,
  pointsPerGame: 11,
  deuceEnabled: false,
  deuceAt: 10,
  clearBy: 2,
  maxPoints: 15,
};

function emptyGame(gameNumber: number): ScoreGame {
  return {
    gameNumber,
    p1Score: 0,
    p2Score: 0,
    winner: null,
    startedAt: null,
    endedAt: null,
  };
}

function makeMatch(scores: ScoreGame[]): MatchDocument {
  return {
    id: 'm1',
    category: 'MS',
    round: 'group',
    groupId: null,
    courtNumber: null,
    scheduledTime: null,
    status: 'live',
    player1Id: 'p1id',
    player2Id: 'p2id',
    player1Name: 'Alice',
    player2Name: 'Bob',
    scores,
    winnerId: null,
    scorekeeperId: null,
    startedAt: null,
    completedAt: null,
    nextMatchId: null,
  };
}

describe('gamesNeededToWinMatch', () => {
  it('returns 1 for best-of-1', () => {
    expect(gamesNeededToWinMatch(1)).toBe(1);
  });
  it('returns 2 for best-of-3', () => {
    expect(gamesNeededToWinMatch(3)).toBe(2);
  });
});

describe('getCurrentGame', () => {
  it('returns the canonical empty game when match is null', () => {
    const { index, game } = getCurrentGame(null);
    expect(index).toBe(0);
    expect(game.p1Score).toBe(0);
    expect(game.p2Score).toBe(0);
    expect(game.winner).toBeNull();
  });
  it('returns the canonical empty game when scores is empty', () => {
    const { index } = getCurrentGame(makeMatch([]));
    expect(index).toBe(0);
  });
  it('returns the first open game (winner === null)', () => {
    const g1: ScoreGame = { ...emptyGame(1), p1Score: 21, winner: 'p1' };
    const g2: ScoreGame = { ...emptyGame(2), p1Score: 5, p2Score: 3 };
    const { index, game } = getCurrentGame(makeMatch([g1, g2]));
    expect(index).toBe(1);
    expect(game).toBe(g2);
  });
  it('returns the last game if every game is already won', () => {
    const g1: ScoreGame = { ...emptyGame(1), winner: 'p1' };
    const g2: ScoreGame = { ...emptyGame(2), winner: 'p1' };
    const { index, game } = getCurrentGame(makeMatch([g1, g2]));
    expect(index).toBe(1);
    expect(game).toBe(g2);
  });
});

describe('getGameWinner — no deuce', () => {
  it('returns null until someone reaches pointsPerGame', () => {
    expect(getGameWinner(20, 19, RULES_21_NO_DEUCE)).toBeNull();
  });
  it("returns 'p1' when p1 reaches threshold first", () => {
    expect(getGameWinner(21, 0, RULES_21_NO_DEUCE)).toBe('p1');
  });
  it("returns 'p2' when p2 reaches threshold first", () => {
    expect(getGameWinner(19, 21, RULES_21_NO_DEUCE)).toBe('p2');
  });
});

describe('getGameWinner — deuce', () => {
  it('21-19 wins (lead by 2 at threshold)', () => {
    expect(getGameWinner(21, 19, RULES_21_DEUCE)).toBe('p1');
  });
  it('21-20 → null (lead by only 1)', () => {
    expect(getGameWinner(21, 20, RULES_21_DEUCE)).toBeNull();
  });
  it('22-20 wins above threshold', () => {
    expect(getGameWinner(22, 20, RULES_21_DEUCE)).toBe('p1');
  });
  it('29-29 → null (no cap, no clear-by-2)', () => {
    expect(getGameWinner(29, 29, RULES_21_DEUCE)).toBeNull();
  });
  it('30-29 wins at cap', () => {
    expect(getGameWinner(30, 29, RULES_21_DEUCE)).toBe('p1');
  });
  it('29-30 → p2 wins at cap', () => {
    expect(getGameWinner(29, 30, RULES_21_DEUCE)).toBe('p2');
  });
});

describe('countWins', () => {
  it('counts winners per side', () => {
    const scores: ScoreGame[] = [
      { ...emptyGame(1), winner: 'p1' },
      { ...emptyGame(2), winner: 'p2' },
      { ...emptyGame(3), winner: 'p1' },
      { ...emptyGame(4), winner: null },
    ];
    expect(countWins(scores)).toEqual({ p1: 2, p2: 1 });
  });
});

describe('getMatchWinner', () => {
  it('returns null until a side has won the needed games', () => {
    expect(getMatchWinner([{ ...emptyGame(1), winner: 'p1' }], 3)).toBeNull();
  });
  it('returns the side that has won enough games', () => {
    const scores = [
      { ...emptyGame(1), winner: 'p1' as const },
      { ...emptyGame(2), winner: 'p1' as const },
    ];
    expect(getMatchWinner(scores, 3)).toBe('p1');
  });
});

describe('getServiceCourt', () => {
  it('returns right when server score is even', () => {
    expect(getServiceCourt(0)).toBe('right');
    expect(getServiceCourt(2)).toBe('right');
  });
  it('returns left when server score is odd', () => {
    expect(getServiceCourt(1)).toBe('left');
    expect(getServiceCourt(7)).toBe('left');
  });
});

describe('isDeuce', () => {
  it('is true when both scores ≥ deuceAt and below maxPoints, with deuce enabled', () => {
    expect(isDeuce(20, 20, RULES_21_DEUCE)).toBe(true);
    expect(isDeuce(25, 24, RULES_21_DEUCE)).toBe(true);
  });
  it('is false when deuce is disabled', () => {
    expect(isDeuce(20, 20, RULES_21_NO_DEUCE)).toBe(false);
  });
  it('is false at the cap (maxPoints reached)', () => {
    expect(isDeuce(30, 29, RULES_21_DEUCE)).toBe(false);
  });
});

describe('shouldTriggerMidGameInterval', () => {
  it('fires on the transition where leading score first reaches 11', () => {
    expect(shouldTriggerMidGameInterval(11, 7, 10, 7)).toBe(true);
  });
  it('does not fire when leading score is still below 11', () => {
    expect(shouldTriggerMidGameInterval(10, 7, 9, 7)).toBe(false);
  });
  it('does not fire on a subsequent point above 11', () => {
    expect(shouldTriggerMidGameInterval(12, 7, 11, 7)).toBe(false);
  });
});

describe('shouldTriggerChangeOfEnds', () => {
  it('only fires in the deciding game', () => {
    expect(shouldTriggerChangeOfEnds(1, 3, 11, 5, 10, 5)).toBe(false);
    expect(shouldTriggerChangeOfEnds(3, 3, 11, 5, 10, 5)).toBe(true);
  });
  it('never fires in best-of-1 game 2 (impossible) or game 1 of best-of-3', () => {
    expect(shouldTriggerChangeOfEnds(1, 1, 11, 5, 10, 5)).toBe(true); // bo1 deciding game
    expect(shouldTriggerChangeOfEnds(1, 3, 11, 5, 10, 5)).toBe(false);
  });
});

describe('getSideSwapPoint', () => {
  it('is 11 for 21-point games', () => {
    expect(getSideSwapPoint(RULES_21_DEUCE)).toBe(11);
  });
  it('is the midpoint (rounded up) for non-21 games', () => {
    expect(getSideSwapPoint(RULES_11_BO1_NO_DEUCE)).toBe(6);
  });
});

describe('shouldSwapSides', () => {
  it('only swaps in the deciding game', () => {
    expect(shouldSwapSides(0, 3, false, 11, 5, RULES_21_BO3)).toBe(false);
    expect(shouldSwapSides(2, 3, false, 11, 5, RULES_21_BO3)).toBe(true);
  });
  it('does not swap a second time once already swapped', () => {
    expect(shouldSwapSides(2, 3, true, 11, 5, RULES_21_BO3)).toBe(false);
  });
});

describe('applyScoreChange — basic increments', () => {
  it("increments p1's score and starts service with p1", () => {
    const match = makeMatch([emptyGame(1)]);
    const r = applyScoreChange({ match, rules: RULES_21_DEUCE, player: 'p1', delta: 1 });
    expect(r.gamePatch.p1Score).toBe(1);
    expect(r.gamePatch.p2Score).toBe(0);
    expect(r.gamePatch.currentServer).toBe('p1');
    expect(r.nextServer).toBe('p1');
    expect(r.gamePatch.pointHistory).toEqual([[1, 0]]);
    expect(r.intervalEvent).toBeNull();
    expect(r.gameWinner).toBeNull();
    expect(r.matchWinner).toBeNull();
  });
  it("swaps server on service-over", () => {
    const game: ScoreGame = { ...emptyGame(1), p1Score: 1, currentServer: 'p1', pointHistory: [[1, 0]] };
    const match = makeMatch([game]);
    const r = applyScoreChange({ match, rules: RULES_21_DEUCE, player: 'p2', delta: 1 });
    expect(r.nextServer).toBe('p2');
    expect(r.gamePatch.currentServer).toBe('p2');
  });
});

describe('applyScoreChange — invalid / undo', () => {
  it('rejects a negative score', () => {
    const match = makeMatch([{ ...emptyGame(1) }]);
    const r = applyScoreChange({ match, rules: RULES_21_DEUCE, player: 'p1', delta: -1 });
    expect(r.rejected).toBe(true);
  });
  it('on undo (delta=-1) does not fire intervals or game-complete', () => {
    const game: ScoreGame = { ...emptyGame(1), p1Score: 11, p2Score: 7, currentServer: 'p1', pointHistory: [[11, 7]] };
    const match = makeMatch([game]);
    const r = applyScoreChange({ match, rules: RULES_21_DEUCE, player: 'p1', delta: -1 });
    expect(r.rejected).toBe(false);
    expect(r.intervalEvent).toBeNull();
    expect(r.gameWinner).toBeNull();
    expect(r.gamePatch.p1Score).toBe(10);
    // pointHistory is not extended on a decrement
    expect(r.gamePatch.pointHistory).toEqual([[11, 7]]);
  });
});

describe('applyScoreChange — mid-game interval and change-of-ends', () => {
  it('fires mid-game interval when leading score first reaches 11 (non-deciding game)', () => {
    const game: ScoreGame = { ...emptyGame(1), p1Score: 10, p2Score: 7, currentServer: 'p1' };
    const match = makeMatch([game]);
    const r = applyScoreChange({ match, rules: RULES_21_BO3, player: 'p1', delta: 1 });
    expect(r.gamePatch.p1Score).toBe(11);
    expect(r.intervalEvent).toBe('mid-game');
  });
  it('fires change-of-ends in the deciding game (game 3 of bo3), overriding mid-game', () => {
    const finished: ScoreGame = { ...emptyGame(1), p1Score: 21, p2Score: 5, winner: 'p1' };
    const finished2: ScoreGame = { ...emptyGame(2), p1Score: 5, p2Score: 21, winner: 'p2' };
    const decider: ScoreGame = { ...emptyGame(3), p1Score: 10, p2Score: 7, currentServer: 'p1' };
    const match = makeMatch([finished, finished2, decider]);
    const r = applyScoreChange({ match, rules: RULES_21_BO3, player: 'p1', delta: 1 });
    expect(r.intervalEvent).toBe('change-ends');
  });
  it('swaps sides in the deciding game when leader hits the swap point', () => {
    const finished: ScoreGame = { ...emptyGame(1), p1Score: 21, p2Score: 5, winner: 'p1' };
    const finished2: ScoreGame = { ...emptyGame(2), p1Score: 5, p2Score: 21, winner: 'p2' };
    const decider: ScoreGame = { ...emptyGame(3), p1Score: 10, p2Score: 7, currentServer: 'p1' };
    const match = makeMatch([finished, finished2, decider]);
    const r = applyScoreChange({ match, rules: RULES_21_BO3, player: 'p1', delta: 1 });
    expect(r.gamePatch.sidesSwapped).toBe(true);
  });
});

describe('applyScoreChange — game completion', () => {
  it('closes the game and seeds the next one when match continues (bo3)', () => {
    const game: ScoreGame = { ...emptyGame(1), p1Score: 20, p2Score: 5, currentServer: 'p1' };
    const match = makeMatch([game]);
    const r = applyScoreChange({ match, rules: RULES_21_BO3, player: 'p1', delta: 1 });
    expect(r.gameWinner).toBe('p1');
    expect(r.matchWinner).toBeNull();
    expect(r.scores).toHaveLength(2);
    expect(r.scores[0].winner).toBe('p1');
    expect(r.scores[0].p1Score).toBe(21);
    expect(r.scores[1].p1Score).toBe(0);
    expect(r.intervalEvent).toBe('between-games');
  });
  it('does not seed a next game when the match is over (bo1)', () => {
    const game: ScoreGame = { ...emptyGame(1), p1Score: 20, p2Score: 5, currentServer: 'p1' };
    const match = makeMatch([game]);
    const r = applyScoreChange({ match, rules: RULES_21_DEUCE, player: 'p1', delta: 1 });
    expect(r.matchWinner).toBe('p1');
    expect(r.scores).toHaveLength(1);
    expect(r.scores[0].winner).toBe('p1');
    // No between-games interval when match is over
    expect(r.intervalEvent).toBeNull();
  });
  it('p2 winning the deciding game closes the match', () => {
    const finished: ScoreGame = { ...emptyGame(1), p1Score: 21, p2Score: 5, winner: 'p1' };
    const finished2: ScoreGame = { ...emptyGame(2), p1Score: 5, p2Score: 21, winner: 'p2' };
    const decider: ScoreGame = { ...emptyGame(3), p1Score: 19, p2Score: 20, currentServer: 'p2' };
    const match = makeMatch([finished, finished2, decider]);
    const r = applyScoreChange({ match, rules: RULES_21_BO3, player: 'p2', delta: 1 });
    expect(r.gameWinner).toBe('p2');
    expect(r.matchWinner).toBe('p2');
  });
});
