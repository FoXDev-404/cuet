import { env } from "cloudflare:workers";
import type { APIRoute } from "astro";
import { siteUrl } from "../lib/site-url";

export const GET: APIRoute = ({ request }) => {
  const base = siteUrl(request.url);

  // Staging is public on a workers.dev hostname but must never be indexed.
  // Production and local development keep the normal crawl rules.
  const deployedEnv = String((env as unknown as Record<string, unknown>).ENV ?? "")
    .trim()
    .toLowerCase();
  if (deployedEnv === "staging") {
    return new Response("User-agent: *\nDisallow: /\n", {
      headers: {
        "content-type": "text/plain; charset=utf-8",
        "cache-control": "no-store",
      },
    });
  }

  const body = `User-agent: *
Allow: /

Disallow: /dev
Disallow: /dev/
Disallow: /admin
Disallow: /admin/
Disallow: /api/
Disallow: /attempt/
Disallow: /result/
Disallow: /dashboard
Disallow: /login
Disallow: /signup
Disallow: /forgot-password
Disallow: /reset-password
Disallow: /verify-email
Disallow: /forbidden
Disallow: /maintenance
Disallow: /500
Disallow: /search

Sitemap: ${new URL("/sitemap.xml", base).toString()}
`;

  return new Response(body, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, max-age=86400",
    },
  });
};
