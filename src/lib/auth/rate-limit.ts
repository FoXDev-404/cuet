import { env } from "cloudflare:workers";

/**
 * Small fixed-window limiter on KV. KV is eventually consistent, so this is a
 * speed bump rather than a lock; it still blocks ordinary credential stuffing.
 */
export async function rateLimit(
  bucket: string,
  identifier: string,
  limit: number,
  windowSeconds: number,
): Promise<{ allowed: boolean; remaining: number }> {
  const key = `rl:${bucket}:${identifier}`;
  try {
    const current = Number((await env.MEDIA_KV.get(key)) ?? "0");
    if (current >= limit) return { allowed: false, remaining: 0 };
    await env.MEDIA_KV.put(key, String(current + 1), {
      expirationTtl: Math.max(60, windowSeconds),
    });
    return { allowed: true, remaining: Math.max(0, limit - current - 1) };
  } catch {
    // Never lock users out because KV is unavailable.
    return { allowed: true, remaining: limit };
  }
}
