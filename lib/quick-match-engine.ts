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

export function createMatch(input: {
  format: QuickFormat;
  sideAName: string;
  sideBName: string;
  rules: QuickRules;
}): QuickMatch {
  return {
    format: input.format,
    sideAName: input.sideAName,
    sideBName: input.sideBName,
    rules: input.rules,
    completedGames: [],
    currentGame: { a: 0, b: 0, winner: null },
    history: [],
    startedAt: Date.now(),
    matchWinner: null,
  };
}

export function isGameOver(game: QuickGame, rules: QuickRules): Side | null {
  const { a, b } = game;
  const T = rules.pointsToWin;
  const CAP = T + CAP_OFFSET;

  if (rules.deuceEnabled) {
    if (a >= CAP) return 'A';
    if (b >= CAP) return 'B';
    if (a >= T && a - b >= 2) return 'A';
    if (b >= T && b - a >= 2) return 'B';
    return null;
  }
  // No deuce: first to T wins.
  if (a >= T && a > b) return 'A';
  if (b >= T && b > a) return 'B';
  return null;
}

export function currentServer(match: QuickMatch): Side {
  if (match.history.length === 0) return 'A';
  return match.history[match.history.length - 1];
}
