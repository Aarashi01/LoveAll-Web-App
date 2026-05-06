export type QuickFormat = 'singles' | 'doubles';
export type Side = 'A' | 'B';

export interface QuickRules {
  pointsToWin: number;     // 1..99
  bestOf: 1 | 3;
  deuceEnabled: boolean;
}

export interface QuickGame {
  a: number;
  b: number;
  winner: Side | null;
}

export interface QuickMatch {
  format: QuickFormat;
  sideAName: string;
  sideBName: string;
  rules: QuickRules;
  completedGames: QuickGame[];
  currentGame: QuickGame;
  history: Side[];
  startedAt: number;
  matchWinner: Side | null;
}

export const CAP_OFFSET = 9; // CAP = pointsToWin + 9

export function gamesNeededToWinMatch(rules: QuickRules): number {
  return Math.ceil(rules.bestOf / 2);
}
