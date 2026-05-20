import type {
  MatchDocument,
  ScoreGame,
  ScoringRules,
  ServiceCourt,
} from "@/lib/firestore/types";

export type Player = "p1" | "p2";
export type IntervalEvent = "mid-game" | "between-games" | "change-ends";

export interface ActiveGame {
  index: number;
  game: ScoreGame;
}

const EMPTY_GAME: ScoreGame = {
  gameNumber: 1,
  p1Score: 0,
  p2Score: 0,
  winner: null,
  startedAt: null,
  endedAt: null,
};

export function gamesNeededToWinMatch(bestOf: 1 | 3): number {
  return Math.ceil(bestOf / 2);
}

export function getCurrentGame(match: MatchDocument | null): ActiveGame {
  if (!match || match.scores.length === 0) {
    return { index: 0, game: EMPTY_GAME };
  }
  const openIndex = match.scores.findIndex((score) => score.winner === null);
  const index = openIndex === -1 ? match.scores.length - 1 : openIndex;
  return { index, game: match.scores[index] };
}

export function getGameWinner(
  p1Score: number,
  p2Score: number,
  rules: ScoringRules,
): Player | null {
  const high = Math.max(p1Score, p2Score);
  const low = Math.min(p1Score, p2Score);
  const diff = high - low;

  if (!rules.deuceEnabled) {
    if (p1Score >= rules.pointsPerGame) return "p1";
    if (p2Score >= rules.pointsPerGame) return "p2";
    return null;
  }

  if (high >= rules.maxPoints) return p1Score > p2Score ? "p1" : "p2";
  if (high >= rules.pointsPerGame && diff >= rules.clearBy)
    return p1Score > p2Score ? "p1" : "p2";
  return null;
}

export function countWins(scores: ScoreGame[]): { p1: number; p2: number } {
  return scores.reduce(
    (acc, score) => {
      if (score.winner === "p1") acc.p1 += 1;
      if (score.winner === "p2") acc.p2 += 1;
      return acc;
    },
    { p1: 0, p2: 0 },
  );
}

export function getMatchWinner(
  scores: ScoreGame[],
  bestOf: 1 | 3,
): Player | null {
  const need = gamesNeededToWinMatch(bestOf);
  const wins = countWins(scores);
  if (wins.p1 >= need) return "p1";
  if (wins.p2 >= need) return "p2";
  return null;
}

/** BWF service court: right when server's score is even, left when odd. */
export function getServiceCourt(serverScore: number): ServiceCourt {
  return serverScore % 2 === 0 ? "right" : "left";
}

export function isDeuce(
  p1Score: number,
  p2Score: number,
  rules: ScoringRules,
): boolean {
  return (
    rules.deuceEnabled &&
    p1Score >= rules.deuceAt &&
    p2Score >= rules.deuceAt &&
    p1Score < rules.maxPoints &&
    p2Score < rules.maxPoints
  );
}

/**
 * Mid-game interval (BWF Law 16.2): triggered when the leading score first
 * reaches 11. Returns true only on the transition (prev leader was < 11).
 */
export function shouldTriggerMidGameInterval(
  p1Score: number,
  p2Score: number,
  prevP1: number,
  prevP2: number,
): boolean {
  const leading = Math.max(p1Score, p2Score);
  const prevLeading = Math.max(prevP1, prevP2);
  return leading >= 11 && prevLeading < 11;
}

/**
 * Change of ends (BWF Law 11.4): in the deciding game, sides swap when the
 * leading score first reaches 11. Returns true only on the transition.
 */
export function shouldTriggerChangeOfEnds(
  gameNumber: number,
  bestOf: 1 | 3,
  p1Score: number,
  p2Score: number,
  prevP1: number,
  prevP2: number,
): boolean {
  if (gameNumber !== bestOf) return false;
  const leading = Math.max(p1Score, p2Score);
  const prevLeading = Math.max(prevP1, prevP2);
  return leading >= 11 && prevLeading < 11;
}

/** The score at which sides swap in the deciding game (BWF: midpoint, capped at 11). */
export function getSideSwapPoint(rules: ScoringRules): number {
  return rules.pointsPerGame === 21
    ? 11
    : Math.ceil(rules.pointsPerGame / 2);
}

export function shouldSwapSides(
  gameIndex: number,
  bestOf: 1 | 3,
  alreadySwapped: boolean,
  nextP1: number,
  nextP2: number,
  rules: ScoringRules,
): boolean {
  const isFinalGame = gameIndex === bestOf - 1;
  if (!isFinalGame || alreadySwapped) return false;
  const swapAt = getSideSwapPoint(rules);
  return nextP1 === swapAt || nextP2 === swapAt;
}

export interface ScoreChangeInput {
  match: MatchDocument;
  rules: ScoringRules;
  player: Player;
  delta: 1 | -1;
}

export interface ScoreChangeResult {
  /** Updated scores array ready to write back to Firestore. */
  scores: ScoreGame[];
  /** The (possibly newly-created) active game index after applying the point. */
  activeGameIndex: number;
  /** Game-level patch the caller writes via updateScore (current game fields only). */
  gamePatch: {
    p1Score: number;
    p2Score: number;
    currentServer: Player | null;
    sidesSwapped: boolean;
    pointHistory: [number, number][];
  };
  /** The next server, or null if no point has been scored yet. */
  nextServer: Player | null;
  /** The interval that should fire on this point, if any. */
  intervalEvent: IntervalEvent | null;
  /** The Player that won this game on this point, or null. */
  gameWinner: Player | null;
  /** The Player that won the match on this point, or null. */
  matchWinner: Player | null;
  /** True if the score change is invalid (e.g. would go negative) and the caller should bail. */
  rejected: boolean;
}

/**
 * Pure computation of a single score-change action.
 *
 * The route owns IO (Firestore writes, UI state). This module owns the rules:
 * deuce, intervals, change of ends, side swap, game completion, match completion.
 */
export function applyScoreChange(input: ScoreChangeInput): ScoreChangeResult {
  const { match, rules, player, delta } = input;
  const { index, game } = getCurrentGame(match);

  const prevP1 = game.p1Score;
  const prevP2 = game.p2Score;
  const nextP1 = player === "p1" ? prevP1 + delta : prevP1;
  const nextP2 = player === "p2" ? prevP2 + delta : prevP2;

  if (nextP1 < 0 || nextP2 < 0) {
    return {
      scores: match.scores,
      activeGameIndex: index,
      gamePatch: {
        p1Score: prevP1,
        p2Score: prevP2,
        currentServer: game.currentServer ?? null,
        sidesSwapped: game.sidesSwapped ?? false,
        pointHistory: game.pointHistory ?? [],
      },
      nextServer: game.currentServer ?? null,
      intervalEvent: null,
      gameWinner: null,
      matchWinner: null,
      rejected: true,
    };
  }

  // Server: first scoring point on an empty game sets the initial server;
  // otherwise service-over moves to the side that just scored.
  let currentServer: Player | null = game.currentServer ?? null;
  if (!currentServer && delta === 1) currentServer = player;
  let nextServer: Player | null = currentServer;
  if (delta === 1 && currentServer && currentServer !== player) {
    nextServer = player;
  }

  const alreadySwapped = game.sidesSwapped ?? false;
  const sidesSwapped =
    alreadySwapped ||
    shouldSwapSides(index, rules.bestOf, alreadySwapped, nextP1, nextP2, rules);

  const currentPointHistory = game.pointHistory ?? [];
  const pointHistory: [number, number][] =
    delta === 1
      ? [...currentPointHistory, [nextP1, nextP2]]
      : currentPointHistory;

  const gamePatch = {
    p1Score: nextP1,
    p2Score: nextP2,
    currentServer: nextServer,
    sidesSwapped,
    pointHistory,
  };

  // Undo path — never triggers intervals, game completion, or match completion.
  if (delta === -1) {
    return {
      scores: match.scores,
      activeGameIndex: index,
      gamePatch,
      nextServer,
      intervalEvent: null,
      gameWinner: null,
      matchWinner: null,
      rejected: false,
    };
  }

  // Change-of-ends takes precedence over mid-game interval (same trigger, more important).
  let intervalEvent: IntervalEvent | null = null;
  if (
    shouldTriggerChangeOfEnds(
      game.gameNumber,
      rules.bestOf,
      nextP1,
      nextP2,
      prevP1,
      prevP2,
    )
  ) {
    intervalEvent = "change-ends";
  } else if (
    shouldTriggerMidGameInterval(nextP1, nextP2, prevP1, prevP2)
  ) {
    intervalEvent = "mid-game";
  }

  const gameWinner = getGameWinner(nextP1, nextP2, rules);
  if (!gameWinner) {
    return {
      scores: match.scores,
      activeGameIndex: index,
      gamePatch,
      nextServer,
      intervalEvent,
      gameWinner: null,
      matchWinner: null,
      rejected: false,
    };
  }

  // Game complete — close the current game and (if needed) seed the next one.
  const updatedScores = [...match.scores];
  updatedScores[index] = {
    ...updatedScores[index],
    p1Score: nextP1,
    p2Score: nextP2,
    winner: gameWinner,
  };

  const matchWinner = getMatchWinner(updatedScores, rules.bestOf);

  if (!matchWinner && !updatedScores[index + 1]) {
    updatedScores.push({
      gameNumber: updatedScores.length + 1,
      p1Score: 0,
      p2Score: 0,
      winner: null,
      startedAt: null,
      endedAt: null,
    });
  }

  // When the game completes but the match continues, the between-games
  // interval supersedes any mid-game / change-ends event already detected.
  // When the match ends, keep whatever earlier event fired so the route can
  // still surface it (e.g. an 11-point game ending on the interval trigger).
  if (!matchWinner) intervalEvent = "between-games";

  return {
    scores: updatedScores,
    activeGameIndex: index,
    gamePatch,
    nextServer,
    intervalEvent,
    gameWinner,
    matchWinner,
    rejected: false,
  };
}
