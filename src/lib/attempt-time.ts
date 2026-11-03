/** Server-authoritative attempt timing helpers shared by the API and tests. */
export const SUBMIT_GRACE_SECONDS = 15;

export type DeadlineCarrier = { deadline_at: string };

export function remainingSeconds(attempt: DeadlineCarrier, now = Date.now()): number {
  return Math.max(0, Math.floor((Date.parse(attempt.deadline_at) - now) / 1000));
}

/**
 * A submission is still allowed for a short grace window after the deadline so
 * an autosave request that was already in flight is not lost. Beyond that
 * window, the attempt is settled as expired instead of scored as submitted.
 */
export function hasExpired(attempt: DeadlineCarrier, now = Date.now()): boolean {
  return now > Date.parse(attempt.deadline_at) + SUBMIT_GRACE_SECONDS * 1000;
}
