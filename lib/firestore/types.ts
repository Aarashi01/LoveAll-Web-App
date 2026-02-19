import { FieldValue, Timestamp } from 'firebase/firestore';

export type MatchCategory = 'MS' | 'WS' | 'MD' | 'WD' | 'XD';
export type TournamentStatus = 'draft' | 'group_stage' | 'knockout' | 'completed';
export type MatchRound = 'group' | 'R16' | 'QF' | 'SF' | 'F' | '3rd';
export type MatchStatus = 'scheduled' | 'live' | 'completed' | 'walkover';
export type PlayerGender = 'M' | 'F';
export type AppUserRole = 'organizer';

export type FirestoreDate = Timestamp;
export type FirestoreDateInput = Timestamp | FieldValue;

export interface ScoringRules {
  bestOf: 1 | 3;
  pointsPerGame: 11 | 15 | 21;
  deuceEnabled: boolean;
  deuceAt: number;
  clearBy: number;
  maxPoints: number;
}

export interface TournamentDocument {
  id: string;
  slug: string;
  name: string;
  organizerId: string;
  status: TournamentStatus;
  categories: MatchCategory[];
  scoringRules: ScoringRules;
  groupCount: number;
  knockoutSize: 16 | 8 | 4;
  publicViewEnabled: boolean;
  createdAt: FirestoreDate;
  updatedAt: FirestoreDate;
  venuePin: string;
}

export interface CreateTournamentInput {
  slug: string;
  name: string;
  organizerId: string;
  categories: MatchCategory[];
  scoringRules: ScoringRules;
  groupCount: number;
  knockoutSize: 16 | 8 | 4;
  publicViewEnabled?: boolean;
  venuePin: string;
}

export interface PlayerDocument {
  id: string;
  name: string;
  gender: PlayerGender;
  department?: string;
  categories: MatchCategory[];
  partnerId: string | null;
  groupId: string | null;
  seeded: boolean;
  addedAt: FirestoreDate;
}

export interface CreatePlayerInput {
  name: string;
  gender: PlayerGender;
  department?: string;
  categories: MatchCategory[];
  partnerId?: string | null;
  groupId?: string | null;
  seeded?: boolean;
}

export interface ScoreGame {
  gameNumber: number;
  p1Score: number;
  p2Score: number;
  winner: 'p1' | 'p2' | null;
  startedAt: FirestoreDate | null;
  endedAt: FirestoreDate | null;
}

export interface MatchDocument {
  id: string;
  category: MatchCategory;
  round: MatchRound;
  groupId: string | null;
  courtNumber: number | null;
  scheduledTime: FirestoreDate | null;
  status: MatchStatus;
  player1Id: string;
  player2Id: string;
  player1Name: string;
  player2Name: string;
  scores: ScoreGame[];
  winnerId: string | null;
  scorekeeperId: string | null;
  startedAt: FirestoreDate | null;
  completedAt: FirestoreDate | null;
  nextMatchId: string | null;
}

export interface CreateMatchInput {
  category: MatchCategory;
  round: MatchRound;
  groupId?: string | null;
  courtNumber?: number | null;
  scheduledTime?: FirestoreDateInput | null;
  status?: MatchStatus;
  player1Id: string;
  player2Id: string;
  player1Name: string;
  player2Name: string;
  scores?: ScoreGame[];
  winnerId?: string | null;
  scorekeeperId?: string | null;
  startedAt?: FirestoreDateInput | null;
  completedAt?: FirestoreDateInput | null;
  nextMatchId?: string | null;
}

export interface AppUserDocument {
  id: string;
  email: string;
  displayName: string;
  role: AppUserRole;
  createdAt: FirestoreDate;
  tournamentIds: string[];
}

