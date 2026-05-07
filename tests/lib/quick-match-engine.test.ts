import { gamesNeededToWinMatch, createMatch, isGameOver, currentServer } from '@/lib/quick-match-engine';

const RULES_NO_DEUCE = { pointsToWin: 21, bestOf: 1, deuceEnabled: false } as const;
const RULES_DEUCE = { pointsToWin: 21, bestOf: 1, deuceEnabled: true } as const;
const RULES_BO3 = { pointsToWin: 21, bestOf: 3, deuceEnabled: true } as const;

describe('gamesNeededToWinMatch', () => {
  it('returns 1 for best-of-1', () => {
    expect(gamesNeededToWinMatch({ pointsToWin: 21, bestOf: 1, deuceEnabled: true })).toBe(1);
  });
  it('returns 2 for best-of-3', () => {
    expect(gamesNeededToWinMatch({ pointsToWin: 21, bestOf: 3, deuceEnabled: true })).toBe(2);
  });
});

describe('createMatch', () => {
  it('returns a match with empty completedGames and zeroed currentGame', () => {
    const m = createMatch({
      format: 'singles',
      sideAName: 'A',
      sideBName: 'B',
      rules: RULES_DEUCE,
    });
    expect(m.completedGames).toEqual([]);
    expect(m.currentGame).toEqual({ a: 0, b: 0, winner: null });
    expect(m.history).toEqual([]);
    expect(m.matchWinner).toBeNull();
    expect(m.format).toBe('singles');
    expect(m.sideAName).toBe('A');
    expect(m.sideBName).toBe('B');
    expect(m.rules).toEqual(RULES_DEUCE);
    expect(typeof m.startedAt).toBe('number');
  });
});

describe('isGameOver — no deuce', () => {
  it('returns null while no side has reached pointsToWin', () => {
    expect(isGameOver({ a: 20, b: 19, winner: null }, RULES_NO_DEUCE)).toBeNull();
  });
  it('returns A when A reaches pointsToWin first', () => {
    expect(isGameOver({ a: 21, b: 0, winner: null }, RULES_NO_DEUCE)).toBe('A');
  });
  it('returns B when B reaches pointsToWin first', () => {
    expect(isGameOver({ a: 19, b: 21, winner: null }, RULES_NO_DEUCE)).toBe('B');
  });
});

describe('isGameOver — deuce', () => {
  it('21-19 → A wins (lead by 2 at threshold)', () => {
    expect(isGameOver({ a: 21, b: 19, winner: null }, RULES_DEUCE)).toBe('A');
  });
  it('21-20 → null (lead by only 1)', () => {
    expect(isGameOver({ a: 21, b: 20, winner: null }, RULES_DEUCE)).toBeNull();
  });
  it('22-20 → A wins (lead by 2 above threshold)', () => {
    expect(isGameOver({ a: 22, b: 20, winner: null }, RULES_DEUCE)).toBe('A');
  });
  it('29-29 → null (no cap, no lead-by-2)', () => {
    expect(isGameOver({ a: 29, b: 29, winner: null }, RULES_DEUCE)).toBeNull();
  });
  it('30-29 → A wins via cap', () => {
    expect(isGameOver({ a: 30, b: 29, winner: null }, RULES_DEUCE)).toBe('A');
  });
  it('29-30 → B wins via cap', () => {
    expect(isGameOver({ a: 29, b: 30, winner: null }, RULES_DEUCE)).toBe('B');
  });
});

describe('currentServer', () => {
  it("returns 'A' on a 0-0 fresh match (default)", () => {
    const m = createMatch({ format: 'singles', sideAName: 'A', sideBName: 'B', rules: RULES_DEUCE });
    expect(currentServer(m)).toBe('A');
  });
  it("returns the side of the last point in history", () => {
    const m = createMatch({ format: 'singles', sideAName: 'A', sideBName: 'B', rules: RULES_DEUCE });
    const m2 = { ...m, currentGame: { a: 1, b: 0, winner: null }, history: ['A'] as ('A' | 'B')[] };
    expect(currentServer(m2)).toBe('A');
    const m3 = { ...m, currentGame: { a: 1, b: 1, winner: null }, history: ['A', 'B'] as ('A' | 'B')[] };
    expect(currentServer(m3)).toBe('B');
  });
});

import { applyPoint, isMatchOver } from '@/lib/quick-match-engine';

function applyMany(match: ReturnType<typeof createMatch>, sequence: ('A' | 'B')[]) {
  return sequence.reduce((m, s) => applyPoint(m, s), match);
}

describe('applyPoint — single side increments', () => {
  it('increments side A and pushes history', () => {
    const m = createMatch({ format: 'singles', sideAName: 'A', sideBName: 'B', rules: RULES_DEUCE });
    const m2 = applyPoint(m, 'A');
    expect(m2.currentGame).toEqual({ a: 1, b: 0, winner: null });
    expect(m2.history).toEqual(['A']);
  });
});

describe('applyPoint — completes a game (no deuce, bestOf=1)', () => {
  it('A wins game 1 → match over with matchWinner A', () => {
    const m = createMatch({ format: 'singles', sideAName: 'A', sideBName: 'B', rules: RULES_NO_DEUCE });
    const seq: ('A' | 'B')[] = Array(21).fill('A');
    const m2 = applyMany(m, seq);
    expect(m2.completedGames).toHaveLength(1);
    expect(m2.completedGames[0].winner).toBe('A');
    expect(m2.completedGames[0]).toEqual({ a: 21, b: 0, winner: 'A' });
    expect(m2.currentGame).toEqual({ a: 0, b: 0, winner: null });
    expect(m2.history).toEqual([]);
    expect(m2.matchWinner).toBe('A');
  });
});

describe('applyPoint — completes a game (deuce extension)', () => {
  it('22-20 closes the game', () => {
    const m = createMatch({ format: 'singles', sideAName: 'A', sideBName: 'B', rules: RULES_DEUCE });
    // Reach 20-20 then A wins next two
    const seq: ('A' | 'B')[] = [];
    for (let i = 0; i < 20; i++) { seq.push('A'); seq.push('B'); }
    seq.push('A'); // 21-20
    seq.push('A'); // 22-20 → A wins
    const m2 = applyMany(m, seq);
    expect(m2.completedGames).toHaveLength(1);
    expect(m2.completedGames[0]).toEqual({ a: 22, b: 20, winner: 'A' });
    expect(m2.matchWinner).toBe('A');
  });

  it('cap at 30 fires from 29-29 → next point wins', () => {
    const m = createMatch({ format: 'singles', sideAName: 'A', sideBName: 'B', rules: RULES_DEUCE });
    // Reach 29-29 (deuce game continuing)
    const seq: ('A' | 'B')[] = [];
    for (let i = 0; i < 29; i++) { seq.push('A'); seq.push('B'); }
    seq.push('B'); // 29-30 → B wins via cap
    const m2 = applyMany(m, seq);
    expect(m2.completedGames[0]).toEqual({ a: 29, b: 30, winner: 'B' });
    expect(m2.matchWinner).toBe('B');
  });
});

describe('applyPoint — bestOf=3 progression', () => {
  it('A wins game 1 and game 2 → match over after 2 games', () => {
    const m = createMatch({ format: 'singles', sideAName: 'A', sideBName: 'B', rules: RULES_BO3 });
    // Game 1: A 21-0
    let m2 = applyMany(m, Array(21).fill('A'));
    expect(m2.matchWinner).toBeNull();
    expect(m2.completedGames).toHaveLength(1);
    // Game 2: A 21-0
    m2 = applyMany(m2, Array(21).fill('A'));
    expect(m2.matchWinner).toBe('A');
    expect(m2.completedGames).toHaveLength(2);
  });

  it('1-1 in games then A wins game 3 → match over', () => {
    const m = createMatch({ format: 'singles', sideAName: 'A', sideBName: 'B', rules: RULES_BO3 });
    let m2 = applyMany(m, Array(21).fill('A'));      // game 1 A
    m2 = applyMany(m2, Array(21).fill('B'));         // game 2 B
    expect(m2.matchWinner).toBeNull();
    m2 = applyMany(m2, Array(21).fill('A'));         // game 3 A
    expect(m2.matchWinner).toBe('A');
    expect(m2.completedGames).toHaveLength(3);
  });
});

describe('applyPoint — no-op after match over', () => {
  it('does not modify match once matchWinner is set', () => {
    const m = createMatch({ format: 'singles', sideAName: 'A', sideBName: 'B', rules: RULES_NO_DEUCE });
    let m2 = applyMany(m, Array(21).fill('A'));
    expect(m2.matchWinner).toBe('A');
    const m3 = applyPoint(m2, 'B');
    expect(m3).toBe(m2); // identity — no-op
  });
});

describe('isMatchOver', () => {
  it('returns null until a side has won enough games', () => {
    const m = createMatch({ format: 'singles', sideAName: 'A', sideBName: 'B', rules: RULES_BO3 });
    expect(isMatchOver(m)).toBeNull();
  });
  it('returns the side that has won enough games', () => {
    const m = createMatch({ format: 'singles', sideAName: 'A', sideBName: 'B', rules: RULES_BO3 });
    const m2 = { ...m, completedGames: [
      { a: 21, b: 0, winner: 'A' as const },
      { a: 21, b: 0, winner: 'A' as const },
    ] };
    expect(isMatchOver(m2)).toBe('A');
  });
});

import { undoLastPoint } from '@/lib/quick-match-engine';

describe('undoLastPoint', () => {
  it('decrements the last side scored and pops history', () => {
    const m = createMatch({ format: 'singles', sideAName: 'A', sideBName: 'B', rules: RULES_DEUCE });
    let m2 = applyPoint(m, 'A');
    m2 = applyPoint(m2, 'A');
    m2 = applyPoint(m2, 'B');
    // 2-1, history = [A,A,B]
    const m3 = undoLastPoint(m2);
    expect(m3.currentGame).toEqual({ a: 2, b: 0, winner: null });
    expect(m3.history).toEqual(['A', 'A']);
  });

  it('is a no-op when history is empty', () => {
    const m = createMatch({ format: 'singles', sideAName: 'A', sideBName: 'B', rules: RULES_DEUCE });
    const m2 = undoLastPoint(m);
    expect(m2).toBe(m);
  });

  it('does NOT cross game boundaries (after a game ends, history is empty)', () => {
    const m = createMatch({ format: 'singles', sideAName: 'A', sideBName: 'B', rules: RULES_BO3 });
    // Win game 1 by A 21-0
    let m2 = m;
    for (let i = 0; i < 21; i++) m2 = applyPoint(m2, 'A');
    expect(m2.completedGames).toHaveLength(1);
    expect(m2.history).toEqual([]);
    const m3 = undoLastPoint(m2);
    expect(m3).toBe(m2); // no-op — history is empty
    expect(m3.completedGames).toHaveLength(1);
  });
});
