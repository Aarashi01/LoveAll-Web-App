import { computeBannerState } from '@/lib/banner-state';

describe('computeBannerState', () => {
  it('returns "expired" when remaining ≤ 0', () => {
    expect(computeBannerState(0)).toBe('expired');
    expect(computeBannerState(-1000)).toBe('expired');
  });

  it('returns "critical" when ≤ 5 minutes remain', () => {
    expect(computeBannerState(4 * 60 * 1000)).toBe('critical');
    expect(computeBannerState(1)).toBe('critical');
  });

  it('returns "warning" when 5–30 minutes remain', () => {
    expect(computeBannerState(6 * 60 * 1000)).toBe('warning');
    expect(computeBannerState(29 * 60 * 1000)).toBe('warning');
  });

  it('returns "ok" when > 30 minutes remain', () => {
    expect(computeBannerState(31 * 60 * 1000)).toBe('ok');
    expect(computeBannerState(8 * 60 * 60 * 1000)).toBe('ok');
  });
});
