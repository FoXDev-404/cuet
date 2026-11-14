import { describe, expect, it } from "vitest";
import {
  EDGE_CACHE_SITEMAP_TTL_SECONDS,
  EDGE_CACHE_TTL_SECONDS,
  edgeCacheTtlForPath,
  isEdgeCacheableContentType,
  isEdgeCacheablePath,
  shouldAttemptEdgeCache,
} from "../../src/lib/edge-cache";

describe("edge cache path rules", () => {
  it("caches the root and all content prefixes", () => {
    expect(isEdgeCacheablePath("/")).toBe(true);
    expect(isEdgeCacheablePath("/mock-tests")).toBe(true);
    expect(isEdgeCacheablePath("/mock-tests/english-2026-06-06-shift-1")).toBe(true);
    expect(isEdgeCacheablePath("/blog/how-to-use-cuet-previous-year-papers")).toBe(true);
    expect(isEdgeCacheablePath("/cuet-ug-previous-year-question-papers")).toBe(true);
    expect(isEdgeCacheablePath("/cuet-ug-syllabus/physics")).toBe(true);
    expect(isEdgeCacheablePath("/leaderboard/english-2026-06-06-shift-1")).toBe(true);
    expect(isEdgeCacheablePath("/pyq/2026/english")).toBe(true);
    expect(isEdgeCacheablePath("/q/abc123def456")).toBe(true);
    expect(isEdgeCacheablePath("/sitemap.xml")).toBe(true);
    expect(isEdgeCacheablePath("/privacy-policy")).toBe(true);
  });

  it("never caches dynamic, private or exam-flow paths", () => {
    for (const path of [
      "/api/health",
      "/api/attempts/1",
      "/attempt/5",
      "/result/9",
      "/dashboard",
      "/admin/mocks",
      "/login",
      "/signup",
      "/search?q=english",
      "/u/someone",
      "/mock/english-2026-06-06-shift-1/discussion",
      "/maintenance",
      "/forbidden",
    ]) {
      expect(isEdgeCacheablePath(path), path).toBe(false);
    }
  });

  it("does not confuse prefixes with sibling paths", () => {
    expect(isEdgeCacheablePath("/mock-tests-extra")).toBe(false);
    expect(isEdgeCacheablePath("/blogroll")).toBe(false);
    expect(isEdgeCacheablePath("/questions")).toBe(false);
    expect(isEdgeCacheablePath("/sitemap.xml.bak")).toBe(false);
  });
});

describe("edge cache attempt rules", () => {
  const base = {
    method: "GET",
    pathname: "/mock-tests",
    search: "",
    hasSessionCookie: false,
    isProduction: true,
  };

  it("attempts the cache for anonymous GETs on production", () => {
    expect(shouldAttemptEdgeCache(base)).toBe(true);
  });

  it("skips dev, E2E and preview environments entirely", () => {
    expect(shouldAttemptEdgeCache({ ...base, isProduction: false })).toBe(false);
  });

  it("skips signed-in users and query strings", () => {
    expect(shouldAttemptEdgeCache({ ...base, hasSessionCookie: true })).toBe(false);
    expect(shouldAttemptEdgeCache({ ...base, search: "?year=2026" })).toBe(false);
  });

  it("skips non-GET methods", () => {
    expect(shouldAttemptEdgeCache({ ...base, method: "POST" })).toBe(false);
    expect(shouldAttemptEdgeCache({ ...base, method: "HEAD" })).toBe(true);
  });
});

describe("edge cache TTL", () => {
  it("is five minutes for pages and six hours for the sitemap", () => {
    expect(EDGE_CACHE_TTL_SECONDS).toBe(300);
    expect(EDGE_CACHE_SITEMAP_TTL_SECONDS).toBe(21_600);
    expect(edgeCacheTtlForPath("/blog/guide")).toBe(EDGE_CACHE_TTL_SECONDS);
    expect(edgeCacheTtlForPath("/sitemap.xml")).toBe(EDGE_CACHE_SITEMAP_TTL_SECONDS);
  });
});

describe("edge cache content types", () => {
  it("stores pages and XML feeds, never JSON APIs", () => {
    expect(isEdgeCacheableContentType("text/html; charset=utf-8")).toBe(true);
    expect(isEdgeCacheableContentType("application/xml; charset=utf-8")).toBe(true);
    expect(isEdgeCacheableContentType("text/xml")).toBe(true);
    expect(isEdgeCacheableContentType("application/json; charset=utf-8")).toBe(false);
    expect(isEdgeCacheableContentType("text/plain")).toBe(false);
    expect(isEdgeCacheableContentType("")).toBe(false);
  });
});
