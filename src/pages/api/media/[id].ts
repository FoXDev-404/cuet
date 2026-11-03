import type { APIRoute } from "astro";
import { first } from "../../../lib/db";
import { getMedia } from "../../../lib/media";

export const GET: APIRoute = async ({ params }) => {
  const id = params.id ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return new Response("Not found", { status: 404 });
  }

  const asset = await first<{
    object_key: string;
    mime_type: string;
    size_bytes: number;
  }>("SELECT object_key, mime_type, size_bytes FROM media_assets WHERE id = ?", id);
  if (!asset) return new Response("Not found", { status: 404 });

  const bytes = await getMedia(asset.object_key);
  if (!bytes) return new Response("Not found", { status: 404 });

  return new Response(bytes, {
    status: 200,
    headers: {
      "content-type": asset.mime_type,
      "content-length": String(asset.size_bytes),
      "cache-control": "public, max-age=31536000, immutable",
      "x-content-type-options": "nosniff",
      "content-security-policy": "default-src 'none'; sandbox",
    },
  });
};
