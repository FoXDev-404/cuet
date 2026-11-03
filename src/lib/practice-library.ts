import staticIndex from "../data/local-papers/index.json";
import {
  buildSubjectSummaries,
  buildSummary,
  sortPracticeSummaries,
  type LocalPaper,
  type LocalPaperSummary,
  type LocalSubjectSummary,
  type RawIndex,
} from "./practice-normalize";

/**
 * Runtime wiring for the practice library.
 *
 * The public pages consume the library synchronously, so one cheap index query
 * is warmed by middleware and cached in module scope; individual papers are
 * loaded from D1 on demand. Tests inject a JSON-backed store instead.
 */
export interface PracticeLibraryStore {
  loadIndex(): Promise<LocalPaperSummary[]>;
  loadPaper(slug: string): Promise<LocalPaper | null>;
}

export interface PracticeLibrarySnapshot {
  papers: LocalPaperSummary[];
  papersBySlug: Map<string, LocalPaperSummary>;
  subjectSummaries: Map<string, LocalSubjectSummary>;
  loadedAt: number;
}

let store: PracticeLibraryStore | null = null;
let snapshot: PracticeLibrarySnapshot | null = null;
let warming: Promise<PracticeLibrarySnapshot> | null = null;

const DEFAULT_TTL_MS = 30_000;

/**
 * Backoff before D1 is retried after a failed load, so a broken or
 * quota-blocked database is not hammered on every request.
 */
const FAILURE_BACKOFF_MS = 300_000;

let lastFailureAt = 0;

/**
 * Snapshot built from the bundled `src/data/local-papers/index.json`.
 *
 * That file is committed with the library, so the listing pages keep working
 * when D1 is unreachable (daily row-read quota exhausted, database busy).
 * D1 stays the source of truth; this is only the fallback.
 */
export function createBundledPracticeSnapshot(): PracticeLibrarySnapshot {
  const raw = (staticIndex as RawIndex).papers ?? [];
  const papers = raw
    .map((row) => buildSummary(row))
    .filter((paper): paper is LocalPaperSummary => paper !== null);
  return createPracticeSnapshot(papers);
}

export function createPracticeSnapshot(
  papers: LocalPaperSummary[],
  loadedAt = Date.now(),
): PracticeLibrarySnapshot {
  const sorted = sortPracticeSummaries(papers);
  return {
    papers: sorted,
    papersBySlug: new Map(sorted.map((paper) => [paper.slug, paper])),
    subjectSummaries: buildSubjectSummaries(sorted),
    loadedAt,
  };
}

/** Installs the production store. Used once from the middleware module. */
export function setPracticeLibraryStore(next: PracticeLibraryStore): void {
  store = next;
  snapshot = null;
  warming = null;
}

/** Injects a fixed snapshot, primarily for unit tests and offline tooling. */
export function usePracticeLibrary(
  papers: LocalPaperSummary[],
  loadedAt = Date.now(),
): PracticeLibrarySnapshot {
  snapshot = createPracticeSnapshot(papers, loadedAt);
  warming = null;
  return snapshot;
}

/**
 * Refreshes the index when the cached snapshot is older than `maxAgeMs`.
 * A failed refresh keeps serving the previous snapshot; when there is none the
 * error propagates so a missing migration is visible instead of silently
 * rendering an empty library.
 */
export function ensurePracticeLibrary(maxAgeMs = DEFAULT_TTL_MS): Promise<PracticeLibrarySnapshot> {
  const ttl =
    lastFailureAt && Date.now() - lastFailureAt < FAILURE_BACKOFF_MS
      ? FAILURE_BACKOFF_MS
      : maxAgeMs;
  if (snapshot && Date.now() - snapshot.loadedAt < ttl) {
    return Promise.resolve(snapshot);
  }
  if (warming) return warming;
  if (!store) {
    return Promise.reject(
      new Error(
        "Practice library store is not configured. Apply migration 0010 and import the library, then serve through the Astro middleware.",
      ),
    );
  }

  const activeStore = store;
  warming = activeStore
    .loadIndex()
    .then((papers) => {
      const next = createPracticeSnapshot(papers);
      snapshot = next;
      lastFailureAt = 0;
      return next;
    })
    .catch((error) => {
      lastFailureAt = Date.now();
      if (snapshot) {
        console.error("Practice library refresh failed; serving the last snapshot.", error);
        return snapshot;
      }
      // No usable snapshot yet: fall back to the bundled index so the library
      // pages stay online while D1 is unreachable.
      console.error(
        "Practice library refresh failed; serving the bundled index.",
        error,
      );
      const bundled = createBundledPracticeSnapshot();
      snapshot = bundled;
      return bundled;
    })
    .finally(() => {
      warming = null;
    });

  return warming;
}

export function getPracticeSnapshot(): PracticeLibrarySnapshot {
  if (!snapshot) {
    throw new Error(
      "Practice library is not warm. Middleware must await ensurePracticeLibrary() before rendering a library page.",
    );
  }
  return snapshot;
}

export function getConfiguredStore(): PracticeLibraryStore | null {
  return store;
}
