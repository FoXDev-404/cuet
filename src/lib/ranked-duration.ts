import { calculateMockDuration } from "./exam-timing";

/**
 * Effective exam duration for an attempt.
 *
 * Locked CUET practice papers set their official duration in the database and
 * display it everywhere. When the paper was locked with a duration, that value
 * is authoritative and is what the candidate is told. When it is missing (a
 * legacy or hand-built mock), the CUET per-question rate applies.
 *
 * The general family previously applied its official 1 minute per question to
 * rebuilt **50-question** ranked sets, producing a 50-minute server deadline
 * while every display surface advertised 60 minutes (BUG-002). Preferring the
 * stored value fixes the exam without changing the official reference tables
 * the rest of the site still documents.
 */
export function rankedDurationMinutes(
  storedDurationMin: number | null | undefined,
  questionCount: number,
  subjectName?: string | null,
): number {
  const stored = Number(storedDurationMin);
  if (Number.isFinite(stored) && stored > 0) return Math.floor(stored);
  return calculateMockDuration(questionCount, subjectName).durationMinutes;
}
