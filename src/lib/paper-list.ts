import type { LocalPaperSummary } from "./local-papers";

export const FULL_PAPER_MIN_QUESTIONS = 40;
export const DEFAULT_PAGE_SIZE = 24;

export type PaperType = "full" | "mini";
export type PaperTypeFilter = "full" | "mini" | "all";
export type PaperSort = "newest" | "questions" | "oldest" | "attempts" | "keys";

export interface KeyStatus {
  isFullKey: boolean;
  scoredCount: number;
  totalCount: number;
  label: string;
  tone: "full" | "partial";
}

export interface PaperFilterParams {
  q: string;
  year: number | "all";
  subject: string;
  type: PaperTypeFilter;
  sort: PaperSort;
  page: number;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  startIndex: number;
  endIndex: number;
  hasNext: boolean;
  hasPrev: boolean;
  nextPage: number | null;
  prevPage: number | null;
}

/** Classifies paper as full (>=40 questions) or mini (<40 questions). */
export function classifyPaper(paper: Pick<LocalPaperSummary, "recoveredQuestionCount">): PaperType {
  return paper.recoveredQuestionCount >= FULL_PAPER_MIN_QUESTIONS ? "full" : "mini";
}

/** Derives key status for presentation. Full key: 100% scored; Partial: Key N of M. */
export function getKeyStatus(
  paper: Pick<LocalPaperSummary, "scorableQuestionCount" | "recoveredQuestionCount" | "pendingReviewCount">
): KeyStatus {
  const total = paper.recoveredQuestionCount;
  const scored = paper.scorableQuestionCount;
  const isFull = paper.pendingReviewCount === 0 && scored > 0 && scored === total;

  if (isFull) {
    return {
      isFullKey: true,
      scoredCount: scored,
      totalCount: total,
      label: "Full key",
      tone: "full",
    };
  }

  return {
    isFullKey: false,
    scoredCount: scored,
    totalCount: total,
    label: `Key ${scored} of ${total}`,
    tone: "partial",
  };
}

/** Formats marking scheme using true minus sign '−' (\u2212). */
export function formatMarking(marking: { correct: number; wrong: number; skipped?: number }): string {
  const wrongVal = Math.abs(marking.wrong);
  return `+${marking.correct} / −${wrongVal}`;
}

/**
 * Creates short, scannable title: "Subject · 11 May 2026 · Shift 1"
 * Avoids repeating "CUET UG ... Previous Year Paper".
 */
export function formatShortTitle(
  paper: Pick<LocalPaperSummary, "subject" | "dateLabel" | "year" | "shift">
): string {
  const parts: string[] = [paper.subject.name];
  if (paper.dateLabel) {
    parts.push(paper.dateLabel);
  } else if (paper.year) {
    parts.push(String(paper.year));
  }
  if (paper.shift) {
    parts.push(paper.shift);
  }
  return parts.join(" · ");
}

/**
 * Formats date and shift when subject is rendered in a separate pill: "11 May 2026 · Shift 1"
 */
export function formatDateShiftTitle(
  paper: Pick<LocalPaperSummary, "dateLabel" | "year" | "shift">
): string {
  const parts: string[] = [];
  if (paper.dateLabel) {
    parts.push(paper.dateLabel);
  } else if (paper.year) {
    parts.push(String(paper.year));
  }
  if (paper.shift) {
    parts.push(paper.shift);
  }
  return parts.join(" · ");
}

/** Sanitizes and validates query parameters against allow-lists and bounds. */
export function sanitizeParams(
  raw: URLSearchParams | Record<string, string | undefined>,
  availableYears: number[] = [],
  availableSubjectSlugs: string[] = []
): PaperFilterParams {
  const get = (key: string): string | undefined => {
    if (raw instanceof URLSearchParams) {
      const val = raw.get(key);
      return val === null ? undefined : val;
    }
    return raw[key];
  };

  const q = (get("q") || "").trim();

  const rawYear = get("year");
  let year: number | "all" = "all";
  if (rawYear && rawYear.toLowerCase() !== "all") {
    const parsedYear = Number.parseInt(rawYear, 10);
    if (!Number.isNaN(parsedYear) && (availableYears.length === 0 || availableYears.includes(parsedYear))) {
      year = parsedYear;
    }
  }

  const rawSubject = (get("subject") || "").trim().toLowerCase();
  let subject = "all";
  if (rawSubject && rawSubject !== "all") {
    if (availableSubjectSlugs.length === 0 || availableSubjectSlugs.includes(rawSubject)) {
      subject = rawSubject;
    }
  }

  const rawType = (get("type") || "").trim().toLowerCase();
  let type: PaperTypeFilter = "all"; // Default is All so no papers are hidden
  if (rawType === "mini" || rawType === "all" || rawType === "full") {
    type = rawType;
  }

  const rawSort = (get("sort") || "").trim().toLowerCase();
  let sort: PaperSort = "newest"; // Default is Newest
  if (rawSort === "questions" || rawSort === "oldest" || rawSort === "attempts" || rawSort === "keys" || rawSort === "newest") {
    sort = rawSort;
  }

  const rawPage = get("page");
  let page = 1;
  if (rawPage) {
    const parsedPage = Number.parseInt(rawPage, 10);
    if (!Number.isNaN(parsedPage) && parsedPage >= 1) {
      page = Math.min(parsedPage, 100);
    }
  }

  return { q, year, subject, type, sort, page };
}

/** Checks whether filters deviate from defaults (used for noindex check and 'Clear filters'). */
export function isFiltered(params: PaperFilterParams): boolean {
  return Boolean(
    params.q.length > 0 ||
      params.year !== "all" ||
      params.subject !== "all" ||
      params.type !== "all" ||
      params.sort !== "newest" ||
      params.page > 1
  );
}

/** Filters paper collection by query, year, subject, and type. */
export function applyFilters(papers: LocalPaperSummary[], params: PaperFilterParams): LocalPaperSummary[] {
  let result = papers;

  // Search filter
  if (params.q) {
    const term = params.q.toLowerCase();
    result = result.filter((p) => {
      const matchTitle = p.title.toLowerCase().includes(term);
      const matchSubject = p.subject.name.toLowerCase().includes(term);
      const matchDate = (p.dateLabel ?? "").toLowerCase().includes(term);
      const matchShift = (p.shift ?? "").toLowerCase().includes(term);
      const matchYear = String(p.year).includes(term);
      return matchTitle || matchSubject || matchDate || matchShift || matchYear;
    });
  }

  // Year filter
  if (params.year !== "all") {
    result = result.filter((p) => p.year === params.year);
  }

  // Subject filter
  if (params.subject !== "all") {
    result = result.filter((p) => p.subject.slug === params.subject);
  }

  // Type filter
  if (params.type === "full") {
    result = result.filter((p) => classifyPaper(p) === "full");
  } else if (params.type === "mini") {
    result = result.filter((p) => classifyPaper(p) === "mini");
  }

  return result;
}

/** Sorts papers deterministically by the requested criteria. */
export function sortPapers(papers: LocalPaperSummary[], sort: PaperSort): LocalPaperSummary[] {
  const copy = [...papers];

  if (sort === "questions") {
    return copy.sort(
      (a, b) =>
        b.recoveredQuestionCount - a.recoveredQuestionCount ||
        b.year - a.year ||
        (b.date ?? "").localeCompare(a.date ?? "") ||
        a.title.localeCompare(b.title)
    );
  }

  if (sort === "oldest") {
    return copy.sort((a, b) => {
      const isFullA = classifyPaper(a) === "full" ? 1 : 0;
      const isFullB = classifyPaper(b) === "full" ? 1 : 0;
      if (isFullB !== isFullA) return isFullB - isFullA;

      return (
        a.year - b.year ||
        b.recoveredQuestionCount - a.recoveredQuestionCount ||
        (a.date ?? "").localeCompare(b.date ?? "") ||
        (a.shift ?? "").localeCompare(b.shift ?? "") ||
        a.title.localeCompare(b.title)
      );
    });
  }

  if (sort === "attempts") {
    return copy.sort(
      (a, b) =>
        b.attemptCount - a.attemptCount ||
        b.recoveredQuestionCount - a.recoveredQuestionCount ||
        b.year - a.year ||
        (b.date ?? "").localeCompare(a.date ?? "") ||
        a.title.localeCompare(b.title)
    );
  }

  if (sort === "keys") {
    return copy.sort(
      (a, b) =>
        Number(a.pendingReviewCount > 0) - Number(b.pendingReviewCount > 0) ||
        b.recoveredQuestionCount - a.recoveredQuestionCount ||
        b.year - a.year ||
        (b.date ?? "").localeCompare(a.date ?? "") ||
        a.title.localeCompare(b.title)
    );
  }

  // Default: "newest"
  // Prioritize Full papers on top (>=40 questions), newer years, higher question counts within year, then date
  return copy.sort((a, b) => {
    const isFullA = classifyPaper(a) === "full" ? 1 : 0;
    const isFullB = classifyPaper(b) === "full" ? 1 : 0;
    if (isFullB !== isFullA) return isFullB - isFullA;

    if (b.year !== a.year) return b.year - a.year;

    if (b.recoveredQuestionCount !== a.recoveredQuestionCount) {
      return b.recoveredQuestionCount - a.recoveredQuestionCount;
    }

    const dateComp = (b.date ?? "").localeCompare(a.date ?? "");
    if (dateComp !== 0) return dateComp;

    const shiftComp = (b.shift ?? "").localeCompare(a.shift ?? "");
    if (shiftComp !== 0) return shiftComp;

    return a.title.localeCompare(b.title);
  });
}

export function paginate<T>(items: T[], page = 1, pageSize = DEFAULT_PAGE_SIZE): PaginatedResult<T> {
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.max(1, Math.min(page, totalPages));
  const startIndex = total === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const endIndex = Math.min(safePage * pageSize, total);
  const paginatedItems = items.slice((safePage - 1) * pageSize, safePage * pageSize);

  return {
    items: paginatedItems,
    total,
    page: safePage,
    pageSize,
    totalPages,
    startIndex,
    endIndex,
    hasNext: safePage < totalPages,
    hasPrev: safePage > 1,
    nextPage: safePage < totalPages ? safePage + 1 : null,
    prevPage: safePage > 1 ? safePage - 1 : null,
  };
}

/**
 * Generates URL query string with updated parameters, omitting defaults.
 */
export function buildFilterUrl(
  basePath: string,
  current: PaperFilterParams,
  updates: Partial<PaperFilterParams>
): string {
  const merged: PaperFilterParams = {
    ...current,
    ...updates,
    page: updates.page !== undefined ? updates.page : 1, // reset page on filter changes unless explicitly passed
  };

  const sp = new URLSearchParams();
  if (merged.q) sp.set("q", merged.q);
  if (merged.year !== "all") sp.set("year", String(merged.year));
  if (merged.subject !== "all") sp.set("subject", merged.subject);
  if (merged.type !== "all") sp.set("type", merged.type);
  if (merged.sort !== "newest") sp.set("sort", merged.sort);
  if (merged.page > 1) sp.set("page", String(merged.page));

  const qs = sp.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}

/**
 * Computes 2 to 3 recommended full papers:
 * Rule: Full papers with full key, most recent first, one per different subject,
 * English and General Test preferred.
 */
export function recommendPapers(papers: LocalPaperSummary[], limit = 3): LocalPaperSummary[] {
  // Candidate pool: full papers preferred with full key, then highest scorable ratio
  const fullPapers = papers.filter((p) => classifyPaper(p) === "full");
  const candidates = fullPapers.length > 0 ? fullPapers : papers;

  const scored = candidates.map((p) => {
    let prefScore = 0;
    const sub = p.subject.slug.toLowerCase();
    if (sub.includes("english")) prefScore += 20;
    else if (sub.includes("general")) prefScore += 10;
    if (getKeyStatus(p).isFullKey) prefScore += 50;
    const scorableRatio = (p.scorableQuestionCount || 1) / (p.recoveredQuestionCount || 1);
    return { paper: p, prefScore, scorableRatio };
  });

  scored.sort(
    (a, b) =>
      b.prefScore - a.prefScore ||
      b.scorableRatio - a.scorableRatio ||
      b.paper.year - a.paper.year ||
      (b.paper.date ?? "").localeCompare(a.paper.date ?? "") ||
      a.paper.title.localeCompare(b.paper.title)
  );

  const picked: LocalPaperSummary[] = [];
  const pickedSubjects = new Set<string>();

  for (const item of scored) {
    if (!pickedSubjects.has(item.paper.subject.id)) {
      picked.push(item.paper);
      pickedSubjects.add(item.paper.subject.id);
      if (picked.length >= limit) break;
    }
  }

  return picked;
}
