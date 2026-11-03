import { env } from "cloudflare:workers";

/**
 * Media storage adapter.
 *
 * Blueprint v2 prefers R2 behind a custom domain. R2 is optional here because
 * the launch Cloudflare account may not have R2 enabled; the same object keys
 * work in Workers KV as a documented fallback. Add the MEDIA_R2 binding and
 * set MEDIA_PUBLIC_URL to switch without changing D1 rows.
 */
export type MediaMetadata = { mime: string; alt: string; id: string };

export function usingR2(): boolean {
  return Boolean(env.MEDIA_R2);
}

export function publicMediaUrl(id: string, objectKey: string): string {
  const base = (env.MEDIA_PUBLIC_URL ?? "").trim().replace(/\/$/, "");
  if (usingR2() && base) {
    // Custom domain maps to the bucket root; object keys already include q/.
    return `${base}/${objectKey}`;
  }
  return `/api/media/${id}`;
}

export async function putMedia(objectKey: string, bytes: Uint8Array, metadata: MediaMetadata): Promise<void> {
  if (env.MEDIA_R2) {
    await env.MEDIA_R2.put(objectKey, bytes, {
      httpMetadata: { contentType: metadata.mime },
      customMetadata: { alt: metadata.alt, id: metadata.id },
    });
    return;
  }
  await env.MEDIA_KV.put(objectKey, bytes, { metadata });
}

export async function getMedia(objectKey: string): Promise<ArrayBuffer | null> {
  if (env.MEDIA_R2) {
    const object = await env.MEDIA_R2.get(objectKey);
    if (!object) return null;
    return object.arrayBuffer();
  }
  const object = await env.MEDIA_KV.getWithMetadata<{ mime: string }>(objectKey, {
    type: "arrayBuffer",
  });
  return object.value ?? null;
}

export async function deleteMedia(objectKey: string): Promise<void> {
  if (env.MEDIA_R2) {
    await env.MEDIA_R2.delete(objectKey);
    return;
  }
  await env.MEDIA_KV.delete(objectKey);
}
