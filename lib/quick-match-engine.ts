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

export function isMatchOver(match: QuickMatch): Side | null {
  const need = gamesNeededToWinMatch(match.rules);
  const aWins = match.completedGames.filter((g) => g.winner === 'A').length;
  const bWins = match.completedGames.filter((g) => g.winner === 'B').length;
  if (aWins >= need) return 'A';
  if (bWins >= need) return 'B';
  return null;
}

export function applyPoint(match: QuickMatch, side: Side): QuickMatch {
  if (match.matchWinner) return match;

  const nextGame: QuickGame = {
    a: match.currentGame.a + (side === 'A' ? 1 : 0),
    b: match.currentGame.b + (side === 'B' ? 1 : 0),
    winner: null,
  };
  const winner = isGameOver(nextGame, match.rules);

  if (!winner) {
    return {
      ...match,
      currentGame: nextGame,
      history: [...match.history, side],
    };
  }

  // Game complete — push to completedGames, reset current, clear history.
  const finalGame: QuickGame = { ...nextGame, winner };
  const completedGames = [...match.completedGames, finalGame];
  const aWins = completedGames.filter((g) => g.winner === 'A').length;
  const bWins = completedGames.filter((g) => g.winner === 'B').length;
  const need = gamesNeededToWinMatch(match.rules);
  const matchWinner: Side | null =
    aWins >= need ? 'A' : bWins >= need ? 'B' : null;

  return {
    ...match,
    completedGames,
    currentGame: { a: 0, b: 0, winner: null },
    history: [],
    matchWinner,
  };
}
