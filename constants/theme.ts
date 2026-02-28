import { type MatchCategory, type MatchRound, type PlayerGender, type TournamentStatus } from '@/lib/firestore/types';

export const theme = {
  colors: {
    // Dark mode/Glassmorphism base
    primary: '#0F172A',      // Slate 900 - Deep background
    primarySoft: 'rgba(15, 23, 42, 0.7)', // Slate 900 w/ opacity for glass

    // Vibrant Accents
    accent: '#3B82F6',       // Blue 500 - Electric blue for actions
    focus: '#10B981',        // Emerald 500 - Neon green for live/focus

    // Surfaces
    background: '#0B1120',   // Very dark navy/charcoal
    surface: 'rgba(30, 41, 59, 0.7)',     // Slate 800 w/ opacity
    surfaceSoft: 'rgba(51, 65, 85, 0.5)', // Slate 700 w/ opacity

    // Typography
    text: '#F8FAFC',         // Slate 50 - Pristine white for high contrast
    textMuted: '#94A3B8',    // Slate 400 - Delicate secondary text
    border: 'rgba(255, 255, 255, 0.1)',   // Very subtle border for glass effect

    // Status
    success: '#10B981',      // Emerald 500
    successSoft: 'rgba(16, 185, 129, 0.2)',
    danger: '#EF4444',       // Red 500
    dangerSoft: 'rgba(239, 68, 68, 0.2)',
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
