import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { adsTxtRecord, adsenseClient } from "../lib/integrations";

/**
 * ads.txt is published only after AdSense is configured. Without a valid
 * ADSENSE_CLIENT the route returns 404 rather than serving a placeholder
 * publisher id that could misattribute inventory.
 */
export const GET: APIRoute = () => {
  const record = adsTxtRecord(adsenseClient(env));
  if (!record) {
    return new Response("Not found", {
      status: 404,
      headers: {
        "content-type": "text/plain; charset=utf-8",
        "cache-control": "no-store",
      },
    });
  }

  return new Response(`${record}\n`, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, max-age=3600",
    },
  });
};
