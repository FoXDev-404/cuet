import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("admin review queue scales past its first page", () => {
  const file = read("src/pages/admin/review.astro");

  it("paginates the queue instead of capping it at 50 rows", () => {
    expect(file).toContain("LIMIT ? OFFSET ?");
    expect(file).toContain("const totalPages");
    expect(file).not.toContain("LIMIT 50");
  });

  it("shows active papers first and defaults to active papers", () => {
    expect(file).toContain("ORDER BY p.is_archived ASC");
    expect(file).toMatch(/filterArchived[^\n]*\|\| "active"/);
    expect(file).toContain("p.is_archived = 0");
  });

  it("offers an archived-paper filter", () => {
    expect(file).toContain('name="archived"');
    expect(file).toContain("Active papers");
    expect(file).toContain("Archived papers");
  });
});

describe("admin passages lists every passage", () => {
  const lib = read("src/lib/admin/passages.ts");
  const page = read("src/pages/admin/passages.astro");

  it("counts and paginates inside SQL", () => {
    expect(lib).toContain("COUNT(*)");
    expect(lib).toContain("LIMIT ? OFFSET ?");
    expect(lib).not.toContain("LIMIT 200");
  });

  it("renders the pager and the full total", () => {
    expect(page).toContain("const totalPages");
    expect(page).toContain("pageHref");
    expect(page).toContain("listing.total");
  });
});

describe("admin PYQ rights manager paginates its rows", () => {
  const file = read("src/pages/admin/pyq.astro");

  it("counts and pages the filtered papers in SQL", () => {
    expect(file).toContain("COUNT(*)");
    expect(file).toContain("LIMIT ? OFFSET ?");
    expect(file).toContain("const totalPages");
    expect(file).not.toContain("filteredPapers.map");
  });

  it("keeps the pager and range inside the filters", () => {
    expect(file).toContain("pageHref");
    expect(file).toContain("Showing {rangeStart}");
  });
});

describe("admin mock list paginates its rows", () => {
  const file = read("src/pages/admin/mocks/index.astro");

  it("counts and pages mocks in SQL", () => {
    expect(file).toContain("COUNT(*)");
    expect(file).toContain("LIMIT ? OFFSET ?");
    expect(file).toContain("const totalPages");
  });

  it("renders the total and a page link", () => {
    expect(file).toContain("total");
    expect(file).toContain("pageHref");
  });
});

