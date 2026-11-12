/**
 * Indexability rules for the public exam-info guides.
 *
 * The `exam_info` table is the source of truth: a guide may be indexed only
 * while a human-verified row exists. The constants below are the last
 * known-good verification state committed with the deploy. They are used ONLY
 * when the `exam_info` query itself fails, so a transient database outage can
 * never flip an indexable guide to `noindex` while Google is crawling it.
 *
 * A key that is absent from this map (for example `important-dates` until NTA
 * announces the cycle) stays unverified even when the database is down. That
 * keeps the noindex correct instead of inventing a date.
 */
export const EXAM_INFO_FALLBACK_VERIFICATION: Readonly<Record<string, string>> = {
  eligibility: "2026-11-04",
  "exam-pattern": "2026-11-04",
  "marking-scheme": "2026-11-04",
  "subject-combination": "2026-11-04",
  syllabus: "2026-11-04",
};

/** Subset of an `exam_info` row needed to decide whether a guide is verified. */
export type ExamVerificationRow = {
  value: string;
  last_verified: string | null;
} | null | undefined;

export type ExamVerification = {
  verified: boolean;
  lastVerified: string | null;
  /** True when the database read failed and the deploy-time fallback decided. */
  degraded: boolean;
};

export function isExamInfoVerified(info: ExamVerificationRow): boolean {
  return Boolean(info?.value && info.value !== "TODO_VERIFY" && info.last_verified);
}

/**
 * Resolve whether an exam-info guide may be indexed.
 *
 * When the database answered, its row decides (missing or `TODO_VERIFY` rows
 * stay noindex). When the read failed, the deploy-time fallback decides so an
 * outage never changes indexability.
 */
export function resolveExamVerification(
  key: string,
  info: ExamVerificationRow,
  available: boolean,
): ExamVerification {
  if (available) {
    const verified = isExamInfoVerified(info);
    return {
      verified,
      lastVerified: verified ? (info?.last_verified ?? null) : null,
      degraded: false,
    };
  }
  const fallback = EXAM_INFO_FALLBACK_VERIFICATION[key] ?? null;
  return { verified: Boolean(fallback), lastVerified: fallback, degraded: true };
}
