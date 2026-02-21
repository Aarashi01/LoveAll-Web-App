import { type MatchCategory, type MatchRound, type PlayerGender, type TournamentStatus } from '@/lib/firestore/types';

export const theme = {
  colors: {
    primary: '#0F766E',
    primarySoft: '#CCFBF1',
    accent: '#0369A1',
    focus: '#0EA5E9',
    background: '#EEF2FF',
    surface: '#FFFFFF',
    surfaceSoft: '#F8FAFC',
    text: '#0F172A',
    textMuted: '#475569',
    border: '#CBD5E1',
    success: '#15803D',
    successSoft: '#DCFCE7',
    danger: '#BE123C',
    dangerSoft: '#FFE4E6',
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    xxl: 32,
  },
  radius: {
    sm: 10,
    md: 12,
    lg: 16,
    xl: 20,
    full: 999,
  },
};

export const categoryLabelMap: Record<MatchCategory, string> = {
  MS: "Men's Singles",
  WS: "Women's Singles",
  MD: "Men's Doubles",
  WD: "Women's Doubles",
  XD: 'Mixed Doubles',
};

export const roundLabelMap: Record<MatchRound, string> = {
  group: 'Group Stage',
  R16: 'Round of 16',
  QF: 'Quarterfinal',
  SF: 'Semifinal',
  F: 'Final',
  '3rd': 'Third Place',
};

export const tournamentStatusLabelMap: Record<TournamentStatus, string> = {
  draft: 'Draft',
  group_stage: 'Group Stage',
  knockout: 'Knockout Stage',
  completed: 'Completed',
};

export const playerGenderLabelMap: Record<PlayerGender, string> = {
  M: 'Male',
  F: 'Female',
};

export function toCategoryLabel(category: MatchCategory): string {
  return categoryLabelMap[category];
}

export function toRoundLabel(round: MatchRound): string {
  return roundLabelMap[round];
}

export function toTournamentStatusLabel(status: TournamentStatus): string {
  return tournamentStatusLabelMap[status];
}

export function toPlayerGenderLabel(gender: PlayerGender): string {
  return playerGenderLabelMap[gender];
}
