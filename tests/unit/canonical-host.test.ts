import { describe, expect, it } from "vitest";
import { canonicalHostRedirect, trailingSlashRedirect } from "../../src/lib/canonical-host";

const SITE = "https://cuetfreemocktest.com";

describe("canonicalHostRedirect", () => {
  it("redirects the workers.dev host to the configured domain", () => {
    const target = canonicalHostRedirect(
      new URL("https://cuet-astro.cuet-platform.workers.dev/mock-tests/biology?x=1"),
      SITE,
    );
    expect(target?.toString()).toBe(
      "https://cuetfreemocktest.com/mock-tests/biology?x=1",
    );
  });

  it("redirects the www alias to the apex domain", () => {
    const target = canonicalHostRedirect(new URL("https://www.cuetfreemocktest.com/about"), SITE);
    expect(target?.toString()).toBe("https://cuetfreemocktest.com/about");
  });

  it("upgrades http requests to the canonical protocol in one hop", () => {
    const target = canonicalHostRedirect(
      new URL("http://cuet-astro.cuet-platform.workers.dev/"),
      SITE,
    );
    expect(target?.toString()).toBe("https://cuetfreemocktest.com/");
  });

  it("leaves the canonical host untouched", () => {
    expect(canonicalHostRedirect(new URL("https://cuetfreemocktest.com/blog"), SITE)).toBeNull();
  });

  it("leaves unrelated hosts untouched", () => {
    expect(canonicalHostRedirect(new URL("https://staging.example.com/"), SITE)).toBeNull();
    expect(canonicalHostRedirect(new URL("http://localhost:4321/"), SITE)).toBeNull();
  });

  it("ignores a missing or invalid SITE_URL", () => {
    expect(canonicalHostRedirect(new URL("https://cuet-astro.cuet-platform.workers.dev/"), "")).toBeNull();
    expect(canonicalHostRedirect(new URL("https://cuet-astro.cuet-platform.workers.dev/"), "not a url")).toBeNull();
  });

  it("drops a trailing slash while canonicalising the host", () => {
    const target = canonicalHostRedirect(
      new URL("https://cuet-astro.cuet-platform.workers.dev/mock-tests/biology/"),
      SITE,
    );
    expect(target?.toString()).toBe("https://cuetfreemocktest.com/mock-tests/biology");
  });
});

describe("trailingSlashRedirect", () => {
  it("redirects a slashed content URL to the no-slash form", () => {
    expect(
      trailingSlashRedirect(new URL("https://cuetfreemocktest.com/mock-tests/biology/"), "GET")?.toString(),
    ).toBe("https://cuetfreemocktest.com/mock-tests/biology");
  });

  it("preserves the query string", () => {
    expect(
      trailingSlashRedirect(new URL("https://cuetfreemocktest.com/pyq/2025/?page=2"), "GET")?.toString(),
    ).toBe("https://cuetfreemocktest.com/pyq/2025?page=2");
  });

  it("leaves the root, assets, API and mutations untouched", () => {
    expect(trailingSlashRedirect(new URL("https://cuetfreemocktest.com/"), "GET")).toBeNull();
    expect(trailingSlashRedirect(new URL("https://cuetfreemocktest.com/logo.png/"), "GET")).toBeNull();
    expect(trailingSlashRedirect(new URL("https://cuetfreemocktest.com/api/attempts/"), "GET")).toBeNull();
    expect(trailingSlashRedirect(new URL("https://cuetfreemocktest.com/contact/"), "POST")).toBeNull();
  });

  it("does nothing when the URL already has no slash", () => {
    expect(trailingSlashRedirect(new URL("https://cuetfreemocktest.com/about"), "GET")).toBeNull();
  });
});
