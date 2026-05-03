import { nextMidnight, MAX_SESSION_HOURS } from '@/lib/end-of-day';

describe('nextMidnight', () => {
  it('returns the next 00:00 of the same day if before midnight', () => {
    const now = new Date('2026-05-03T15:30:00.000Z');
    const result = nextMidnight(now);
    expect(result.getHours()).toBe(0);
    expect(result.getMinutes()).toBe(0);
    expect(result.getSeconds()).toBe(0);
    expect(result.getMilliseconds()).toBe(0);
    expect(result.getTime()).toBeGreaterThan(now.getTime());
  });

  it('returns a timestamp within MAX_SESSION_HOURS of now', () => {
    const now = new Date('2026-05-03T03:30:00.000Z');
    const result = nextMidnight(now);
    const diffHours = (result.getTime() - now.getTime()) / (1000 * 60 * 60);
    expect(diffHours).toBeLessThanOrEqual(MAX_SESSION_HOURS);
    expect(diffHours).toBeGreaterThan(0);
  });

  it('exposes MAX_SESSION_HOURS = 24 to match Firestore rule cap', () => {
    expect(MAX_SESSION_HOURS).toBe(24);
  });
});
