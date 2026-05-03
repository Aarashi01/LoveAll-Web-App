/**
 * Hard cap on a scorekeeper session in hours. Mirrors the Firestore rule
 * cap on `scorekeeperAccess.expiresAt` (now + 24h).
 */
export const MAX_SESSION_HOURS = 24;

/**
 * Returns the next 00:00:00 in the *device's local timezone*, computed
 * from `from` (defaults to now).
 *
 * NOTE: Per the spec, per-tournament timezone configuration is a
 * documented limitation / future feature.
 */
export function nextMidnight(from: Date = new Date()): Date {
  const next = new Date(from);
  next.setHours(24, 0, 0, 0);
  return next;
}
