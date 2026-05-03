export type BannerState = 'ok' | 'warning' | 'critical' | 'expired';

const FIVE_MIN = 5 * 60 * 1000;
const THIRTY_MIN = 30 * 60 * 1000;

export function computeBannerState(msRemaining: number): BannerState {
  if (msRemaining <= 0) return 'expired';
  if (msRemaining <= FIVE_MIN) return 'critical';
  if (msRemaining <= THIRTY_MIN) return 'warning';
  return 'ok';
}
