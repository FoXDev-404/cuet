import type { APIRoute } from "astro";
import { first, getDatabaseEngine } from "../../lib/db";

/**
 * Liveness probe for the worker itself.
 *
 * The database state is reported in the body rather than deciding the status
 * code: during a provider quota exhaustion window the database is unreachable
 * for hours, and marking the whole deployment unhealthy then would page
 * operators for a quota issue the app already degrades around. A persistent
 * `db: "down"` in the body is the signal to watch instead.
 */
export const GET: APIRoute = async () => {
  let db: "ok" | "down" = "down";
  let exams = 0;
  try {
    const row = await first<{ count: number }>("SELECT COUNT(*) AS count FROM exams");
    exams = row?.count ?? 0;
    db = "ok";
  } catch (error) {
    console.error("Health check: database unavailable", error);
  }

  return new Response(
    JSON.stringify({
      ok: true,
      db,
      engine: getDatabaseEngine(),
      exams,
      timestamp: new Date().toISOString(),
    }),
    {
      status: 200,
      headers: { "content-type": "application/json", "cache-control": "no-store" },
    },
  );
};
