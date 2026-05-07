import { type MatchCategory, type MatchRound, type PlayerGender, type TournamentStatus } from '@/lib/firestore/types';

// LoveAll design system — inspired by Nike's monochrome athletic aesthetic.
// Principles: paper-white surfaces, jet-black ink, single red accent, sharp
// geometry, pill-shaped CTAs, heavy display type, no glassmorphism.
const SYSTEM_SANS =
  '"Helvetica Neue", "Inter", "Helvetica", "Arial", system-ui, -apple-system, BlinkMacSystemFont, sans-serif';
const SYSTEM_DISPLAY =
  '"Helvetica Neue", "Inter", "Helvetica", "Arial", system-ui, -apple-system, BlinkMacSystemFont, sans-serif';

export const theme = {
  colors: {
    // Surfaces
    background: '#FFFFFF',          // paper white
    surface: '#FFFFFF',             // card surface
    surfaceSoft: '#F5F5F5',         // muted section / hover bed
    surfaceInverse: '#111111',      // ink hero bands
    surfaceInverseSoft: '#1F1F1F',  // ink elevated

    // Ink / typography
    text: '#111111',                // primary ink
    textMuted: '#757575',           // secondary ink
    textSubtle: '#9E9E9E',          // tertiary / placeholder
    textInverse: '#FFFFFF',         // on-ink

    // Strokes
    border: '#E5E5E5',              // hairline divider
    borderStrong: '#111111',        // deliberate outline
    borderSubtle: '#EFEFEF',

    // Primary CTA tone (black is the brand button)
    primary: '#111111',
    primarySoft: '#1F1F1F',

    // Brand accent — Nike red, used sparingly for live / urgency
    accent: '#FA0F00',
    accentSoft: '#FFE6E4',

    // Focus ring (sport-volt for high visibility)
    focus: '#111111',
    volt: '#D7FF1E',                // optional highlight

    // Status
    success: '#00B14A',
    successSoft: '#E8F8EE',
    warning: '#FFA500',
    warningSoft: '#FFF1DB',
    danger: '#FA0F00',
    dangerSoft: '#FFE6E4',
    live: '#FA0F00',
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    xxl: 32,
    xxxl: 48,
  },
  radius: {
    none: 0,
    sm: 2,
    md: 4,
    lg: 6,
    xl: 8,
    full: 999,
  },
  fonts: {
    sans: SYSTEM_SANS,
    display: SYSTEM_DISPLAY,
  },
  // Type scale — bold, geometric, action-led
  type: {
    eyebrow: { size: 11, weight: '800' as const, tracking: 2, transform: 'uppercase' as const },
    label:   { size: 12, weight: '700' as const, tracking: 1.2, transform: 'uppercase' as const },
    body:    { size: 14, weight: '500' as const },
    bodyLg:  { size: 16, weight: '500' as const },
    h4:      { size: 18, weight: '900' as const, tracking: -0.2 },
    h3:      { size: 22, weight: '900' as const, tracking: -0.4 },
    h2:      { size: 32, weight: '900' as const, tracking: -0.8 },
    h1:      { size: 44, weight: '900' as const, tracking: -1.2 },
    display: { size: 64, weight: '900' as const, tracking: -2 },
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
