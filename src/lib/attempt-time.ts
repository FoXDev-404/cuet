/**
 * Server-authoritative attempt timing helpers shared by the API and tests.
 *
 * Clock-skew and timer synchronization model:
 * 1. The server is strictly authoritative. `deadline_at` is anchored in UTC at attempt creation.
 * 2. The client initializes its visual countdown from the server's remaining time, not local machine clock.
 * 3. Client clock skew or manual time manipulation cannot grant extra time.
 * 4. Submissions within `ATTEMPT_GRACE_SECONDS` (15s) are accepted to protect in-flight network requests.
 * 5. Beyond the grace window, any mutation is rejected with `expired` status.
 */
export const ATTEMPT_GRACE_SECONDS = 15;
export const SUBMIT_GRACE_SECONDS = ATTEMPT_GRACE_SECONDS;

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
  return now > Date.parse(attempt.deadline_at) + ATTEMPT_GRACE_SECONDS * 1000;
}
