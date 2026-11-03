import type { APIRoute } from "astro";
import { first } from "../../lib/db";

export const GET: APIRoute = async () => {
  try {
    const row = await first<{ count: number }>("SELECT COUNT(*) AS count FROM exams");
    return new Response(
      JSON.stringify({
        ok: true,
        exams: row?.count ?? 0,
        timestamp: new Date().toISOString(),
      }),
      {
        status: 200,
        headers: { "content-type": "application/json", "cache-control": "no-store" },
      },
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: error instanceof Error ? error.message : "Database unavailable",
      }),
      {
        status: 503,
        headers: { "content-type": "application/json", "cache-control": "no-store" },
      },
    );
  }
};
