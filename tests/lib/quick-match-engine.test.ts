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

void RULES_BO3;
