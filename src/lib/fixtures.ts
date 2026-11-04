/**
 * Fixture & Test Data Isolation Utilities
 *
 * Enforces strict boundary between automated test fixtures / audit artifacts
 * and production-facing surfaces (sitemap, listings, search, leaderboards, attempts).
 */

export const FIXTURE_SLUG_PREFIXES = [
  "e2e-",
  "fixture-",
  "test-",
  "slow-network-",
] as const;

/**
 * Returns true if the slug belongs to an automated test fixture, E2E run, or synthetic benchmark.
 */
export function isFixtureSlug(slug: string | null | undefined): boolean {
  if (!slug) return false;
  const s = slug.toLowerCase().trim();
  return (
    s.startsWith("e2e-") ||
    s.startsWith("fixture-") ||
    s.startsWith("test-") ||
    s.startsWith("slow-network-") ||
    s.includes("fixture") ||
    s.includes("publish-check") ||
    s.includes("share-mock") ||
    s.includes("test-mock") ||
    s.includes("e2e")
  );
}

/**
 * Returns true if a mock test entity is a synthetic test fixture.
 */
export function isFixtureMock(
  mock: { slug?: string | null; title?: string | null } | null | undefined,
): boolean {
  if (!mock) return false;
  if (isFixtureSlug(mock.slug)) return true;
  const title = (mock.title ?? "").toLowerCase().trim();
  return (
    title.startsWith("e2e") ||
    title.includes("fixture") ||
    title.includes("publish check") ||
    title.includes("slow network")
  );
}

/**
 * Returns true if question text indicates synthetic test fixture content.
 */
export function isFixtureQuestion(
  question: { text?: string | null } | null | undefined,
): boolean {
  if (!question) return false;
  const text = (question.text ?? "").toLowerCase().trim();
  return text.includes("e2e fixture") || text.includes("fixture question");
}

/**
 * Detects whether the current execution runtime is configured for production.
 */
export function isProductionEnvironment(customEnv?: Record<string, unknown>): boolean {
  try {
    const val =
      customEnv?.ENV ??
      (typeof process !== "undefined"
        ? process.env?.ENV || process.env?.NODE_ENV
        : "");
    return String(val ?? "").trim().toLowerCase() === "production";
  } catch {
    return false;
  }
}
