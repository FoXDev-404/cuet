/**
 * Helpers for pages that cannot render without the live database.
 *
 * When the database is unavailable, a page that genuinely needs live data
 * should answer with a short 503 instead of an unhandled 500 stack trace.
 */

/**
 * Set by pages that render a bundled fallback instead of live data. Middleware
 * must never store such a response in the edge cache: a transient database
 * failure would otherwise be frozen for every visitor until the TTL expires.
 */
export const DB_DEGRADED_HEADER = "x-db-degraded";

export const DB_UNAVAILABLE_MESSAGE =
  "This page needs live data and the practice database is temporarily unavailable. Please retry in a minute.";

export function dbUnavailableResponse(status = 503): Response {
  return new Response(DB_UNAVAILABLE_MESSAGE, {
    status,
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "retry-after": "60",
      "cache-control": "no-store",
    },
  });
}

/** JSON flavour of {@link dbUnavailableResponse} for API routes. */
export function apiUnavailableResponse(status = 503): Response {
  return new Response(
    JSON.stringify({
      ok: false,
      error: "The database is temporarily unavailable. Please retry in a minute.",
    }),
    {
      status,
      headers: {
        "content-type": "application/json",
        "cache-control": "no-store",
        "retry-after": "60",
      },
    },
  );
}

/**
 * Runs a database-backed loader and returns `fallback` when the database fails.
 * The error is logged so the worker tail still shows the root cause.
 */
export async function orUnavailable<T>(
  label: string,
  loader: () => Promise<T>,
  fallback: T,
): Promise<T> {
  try {
    return await loader();
  } catch (error) {
    console.error(`${label} failed; serving the fallback value.`, error);
    return fallback;
  }
}
