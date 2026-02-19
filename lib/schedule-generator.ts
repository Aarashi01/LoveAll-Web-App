import { type CreateMatchInput, type MatchCategory, type MatchDocument } from '@/lib/firestore/types';

type SchedulePlayer = {
  id: string;
  name: string;
};

export type Standing = {
  id: string;
  name: string;
  played: number;
  wins: number;
  losses: number;
  points: number;
};

function chunkIntoGroups<T>(items: T[], groupSize: number): T[][] {
  if (groupSize <= 0) return [items];
  const groups: T[][] = [];
  for (let i = 0; i < items.length; i += groupSize) {
    groups.push(items.slice(i, i + groupSize));
  }
  return groups;
}

function groupLabelFromIndex(index: number): string {
  if (index < 26) {
    return String.fromCharCode(65 + index);
  }
  return `G${index + 1}`;
}

function blankGameScore() {
  return {
    gameNumber: 1,
    p1Score: 0,
    p2Score: 0,
    winner: null,
    startedAt: null,
    endedAt: null,
  } as const;
}

export function generateGroupMatches(
  players: SchedulePlayer[],
  category: MatchCategory,
  groupSize = 4,
): CreateMatchInput[] {
  const groups = chunkIntoGroups(players, groupSize);
  const matches: CreateMatchInput[] = [];

  groups.forEach((group, groupIndex) => {
    const groupId = `${category}-${groupLabelFromIndex(groupIndex)}`;

    // Round-robin: every player plays every other player once.
    for (let i = 0; i < group.length; i += 1) {
      for (let j = i + 1; j < group.length; j += 1) {
        matches.push({
          category,
          round: 'group',
          groupId,
          player1Id: group[i].id,
          player2Id: group[j].id,
          player1Name: group[i].name,
          player2Name: group[j].name,
          status: 'scheduled',
          scores: [blankGameScore()],
        });
      }
    }
  });

  return matches;
}

export function calculateStandings(matches: MatchDocument[], groupId: string): Standing[] {
  const playerMap = new Map<string, Standing>();

  matches
    .filter((match) => match.groupId === groupId && match.status === 'completed')
    .forEach((match) => {
      if (!playerMap.has(match.player1Id)) {
        playerMap.set(match.player1Id, {
          id: match.player1Id,
          name: match.player1Name,
          played: 0,
          wins: 0,
          losses: 0,
          points: 0,
        });
      }

      if (!playerMap.has(match.player2Id)) {
        playerMap.set(match.player2Id, {
          id: match.player2Id,
          name: match.player2Name,
          played: 0,
          wins: 0,
          losses: 0,
          points: 0,
        });
      }

      const p1 = playerMap.get(match.player1Id)!;
      const p2 = playerMap.get(match.player2Id)!;

      p1.played += 1;
      p2.played += 1;

      if (match.winnerId === match.player1Id) {
        p1.wins += 1;
        p1.points += 2;
        p2.losses += 1;
        p2.points += 1;
      } else if (match.winnerId === match.player2Id) {
        p2.wins += 1;
        p2.points += 2;
        p1.losses += 1;
        p1.points += 1;
      }
    });

  return Array.from(playerMap.values()).sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.wins !== a.wins) return b.wins - a.wins;
    return a.losses - b.losses;
  });
}

function normalizeBracketSize(qualifierCount: number): 4 | 8 | 16 {
  if (qualifierCount <= 4) return 4;
  if (qualifierCount <= 8) return 8;
  return 16;
}

function bracketSeedOrder(size: 4 | 8 | 16): number[] {
  if (size === 4) return [1, 4, 2, 3];
  if (size === 8) return [1, 8, 4, 5, 3, 6, 2, 7];
  return [1, 16, 8, 9, 5, 12, 4, 13, 3, 14, 6, 11, 7, 10, 2, 15];
}

function seedKnockout(players: SchedulePlayer[]): Array<SchedulePlayer | undefined> {
  const size = normalizeBracketSize(players.length);
  const order = bracketSeedOrder(size);
  return order.map((seed) => players[seed - 1]);
}

export function generateKnockoutMatches(
  qualifiers: SchedulePlayer[],
  category: MatchCategory,
  round: 'R16' | 'QF' | 'SF' | 'F',
): CreateMatchInput[] {
  const seeded = seedKnockout(qualifiers);
  const matches: CreateMatchInput[] = [];

  for (let i = 0; i < seeded.length; i += 2) {
    const p1 = seeded[i];
    const p2 = seeded[i + 1];

    matches.push({
      category,
      round,
      groupId: null,
      player1Id: p1?.id ?? 'TBD',
      player2Id: p2?.id ?? 'TBD',
      player1Name: p1?.name ?? 'TBD',
      player2Name: p2?.name ?? 'TBD',
      status: 'scheduled',
      scores: [blankGameScore()],
    });
  }

  return matches;
}
