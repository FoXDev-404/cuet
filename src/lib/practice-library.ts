import {
  buildSubjectSummaries,
  sortPracticeSummaries,
  type LocalPaper,
  type LocalPaperSummary,
  type LocalSubjectSummary,
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
  if (snapshot && Date.now() - snapshot.loadedAt < maxAgeMs) {
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
      return next;
    })
    .catch((error) => {
      if (snapshot) {
        console.error("Practice library refresh failed; serving the last snapshot.", error);
        return snapshot;
      }
      throw error;
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
