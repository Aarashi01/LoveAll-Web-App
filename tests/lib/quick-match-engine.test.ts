import { gamesNeededToWinMatch } from '@/lib/quick-match-engine';

describe('gamesNeededToWinMatch', () => {
  it('returns 1 for best-of-1', () => {
    expect(gamesNeededToWinMatch({ pointsToWin: 21, bestOf: 1, deuceEnabled: true })).toBe(1);
  });
  it('returns 2 for best-of-3', () => {
    expect(gamesNeededToWinMatch({ pointsToWin: 21, bestOf: 3, deuceEnabled: true })).toBe(2);
  });
});
