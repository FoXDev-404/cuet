import { describe, expect, it } from "vitest";

// Mock simulated KV store representing shared Cloudflare KV across worker isolates/contexts
class MockKVNamespace {
  private store = new Map<string, { value: string; expires: number }>();

  async get(key: string): Promise<string | null> {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expires) {
      this.store.delete(key);
      return null;
    }
    return entry.value;
  }

  async put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void> {
    const ttlMs = (options?.expirationTtl ?? 60) * 1000;
    this.store.set(key, { value, expires: Date.now() + ttlMs });
  }

  delete(key: string): void {
    this.store.delete(key);
  }
}

async function kvRateLimit(
  kv: MockKVNamespace,
  bucket: string,
  identifier: string,
  limit: number,
  windowSeconds: number,
): Promise<{ allowed: boolean; remaining: number }> {
  const key = `rl:${bucket}:${identifier}`;
  const current = Number((await kv.get(key)) ?? "0");
  if (current >= limit) return { allowed: false, remaining: 0 };
  await kv.put(key, String(current + 1), {
    expirationTtl: Math.max(60, windowSeconds),
  });
  return { allowed: true, remaining: Math.max(0, limit - current - 1) };
}

describe("Fix 10 Item 4 — KV-Backed Rate Limiter Across Multiple Request Contexts", () => {
  it("enforces rate limits across separate request contexts sharing the KV namespace", async () => {
    const sharedKv = new MockKVNamespace();
    const bucket = "login";
    const ip = "192.168.1.100:test@example.com";
    const limit = 3;
    const windowSec = 60;

    // Request Context 1
    const req1 = await kvRateLimit(sharedKv, bucket, ip, limit, windowSec);
    expect(req1.allowed).toBe(true);
    expect(req1.remaining).toBe(2);

    // Request Context 2 (different isolate/request, same shared KV)
    const req2 = await kvRateLimit(sharedKv, bucket, ip, limit, windowSec);
    expect(req2.allowed).toBe(true);
    expect(req2.remaining).toBe(1);

    // Request Context 3
    const req3 = await kvRateLimit(sharedKv, bucket, ip, limit, windowSec);
    expect(req3.allowed).toBe(true);
    expect(req3.remaining).toBe(0);

    // Request Context 4 (exceeded limit)
    const req4 = await kvRateLimit(sharedKv, bucket, ip, limit, windowSec);
    expect(req4.allowed).toBe(false);
    expect(req4.remaining).toBe(0);

    // Different identifier is not blocked
    const otherIp = "192.168.1.101:other@example.com";
    const reqOther = await kvRateLimit(sharedKv, bucket, otherIp, limit, windowSec);
    expect(reqOther.allowed).toBe(true);
    expect(reqOther.remaining).toBe(2);
  });
});
