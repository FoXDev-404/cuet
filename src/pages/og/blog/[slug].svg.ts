import type { APIRoute } from "astro";
import { blogArtworkSvg } from "../../../lib/blog-artwork";
import { getGuide } from "../../../lib/guides";

export const GET: APIRoute = async ({ params }) => {
  let guide;
  try {
    guide = await getGuide(params.slug ?? "");
  } catch (error) {
    console.error("Blog artwork lookup failed", error);
    return new Response("Guide artwork is temporarily unavailable", { status: 503 });
  }

  if (!guide) return new Response("Guide not found", { status: 404 });

  return new Response(blogArtworkSvg(guide.title, guide.category), {
    headers: {
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
      "Content-Type": "image/svg+xml; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
    },
  });
};
