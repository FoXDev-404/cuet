/**
 * Regression guards for the Lighthouse performance-budget gate.
 *
 * These tests exercise the pure matcher/evaluator used by
 * scripts/lighthouse-audit.mjs, and keep the runner from drifting back to the
 * removed password login endpoint or hard-coded content ids.
 */

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  describeFailure,
  evaluateBudget,
  matchRouteBudget,
  normalizePathname,
} from "../../scripts/lib/perf-budget.mjs";

const ROOT = process.cwd();
const budget = JSON.parse(
  readFileSync(join(ROOT, "performance-budget.json"), "utf8"),
);

const PASSING_METRICS = {
  performanceScore: 95,
  transferKb: 80,
  lcpMs: 1200,
  tbtMs: 50,
  cls: 0.01,
  fcpMs: 900,
  speedIndexMs: 1500,
  domNodes: 500,
};

const PASSING_BUDGET = {
  maxTransferKb: 250,
  targetScore: 85,
  maxLcpMs: 4000,
  maxTbtMs: 600,
};

const GLOBAL_BUDGETS = budget.metrics.mobileSimulated4G;

describe("performance budget route matching", () => {
  it("normalizes query strings, hashes and trailing slashes", () => {
    expect(normalizePathname("/mock-tests/?year=2026#top")).toBe("/mock-tests");
    expect(normalizePathname("mock-tests")).toBe("/mock-tests");
    expect(normalizePathname("/")).toBe("/");
    expect(normalizePathname("")).toBe("/");
  });

  it("matches exact route keys first", () => {
    expect(matchRouteBudget(budget.routeBudgets, "/")?.pattern).toBe("/");
    expect(matchRouteBudget(budget.routeBudgets, "/mock-tests")?.pattern).toBe("/mock-tests");
    expect(matchRouteBudget(budget.routeBudgets, "/admin")?.pattern).toBe("/admin");
    expect(matchRouteBudget(budget.routeBudgets, "/cuet-mock-test/english?tab=pyq")?.pattern).toBe(
      "/cuet-mock-test/english",
    );
  });

  it("matches one dynamic segment without leaking into child routes", () => {
    expect(matchRouteBudget(budget.routeBudgets, "/mock/physics-2026-05-31-shift-2")?.pattern).toBe(
      "/mock/[slug]",
    );
    expect(
      matchRouteBudget(budget.routeBudgets, "/mock/physics-2026-05-31-shift-2/instructions")?.pattern,
    ).toBe("/mock/[slug]/instructions");
    expect(
      matchRouteBudget(budget.routeBudgets, "/mock/physics-2026-05-31-shift-2/discussion"),
    ).toBeNull();
    expect(matchRouteBudget(budget.routeBudgets, "/attempt/603/")?.pattern).toBe("/attempt/[id]");
    expect(matchRouteBudget(budget.routeBudgets, "/result/603")?.pattern).toBe("/result/[id]");
    expect(matchRouteBudget(budget.routeBudgets, "/q/uPJRyUwJ3s")?.pattern).toBe("/q/[id]");
  });

  it("does not silently reuse a parent budget for unbudgeted child routes", () => {
    expect(matchRouteBudget(budget.routeBudgets, "/admin/questions")).toBeNull();
    expect(matchRouteBudget(budget.routeBudgets, "/mock-tests/extra")).toBeNull();
    expect(matchRouteBudget(budget.routeBudgets, "/unknown")).toBeNull();
  });
});

describe("performance budget evaluation", () => {
  it("passes when every metric is inside the route and global caps", () => {
    const evaluation = evaluateBudget({
      budget: PASSING_BUDGET,
      metrics: PASSING_METRICS,
      metricsBudgets: GLOBAL_BUDGETS,
      limits: budget.limits,
    });

    expect(evaluation.pass).toBe(true);
    const failed = evaluation.checks.filter((entry) => entry.pass !== true);
    expect(failed).toEqual([]);
  });

  it("fails a route with no budget instead of skipping it", () => {
    const evaluation = evaluateBudget({ budget: null, metrics: PASSING_METRICS });
    expect(evaluation.pass).toBe(false);
    expect(evaluation.checks[0].metric).toBe("budget");
    expect(describeFailure("/new-route", evaluation.checks[0])).toContain("no route budget");
  });

  it("fails when the performance score is below the route target", () => {
    const evaluation = evaluateBudget({
      budget: { ...PASSING_BUDGET, targetScore: 90 },
      metrics: { ...PASSING_METRICS, performanceScore: 82 },
      metricsBudgets: GLOBAL_BUDGETS,
      limits: budget.limits,
    });

    expect(evaluation.pass).toBe(false);
    expect(
      evaluation.checks.find((entry) => entry.metric === "performanceScore")
        ?.pass,
    ).toBe(false);
  });

  it("fails when transfer, LCP, CLS or DOM exceed their caps", () => {
    const cases = [
      { metric: "transferKb", metrics: { transferKb: 251 } },
      { metric: "lcpMs", metrics: { lcpMs: 4001 } },
      { metric: "cls", metrics: { cls: 0.11 } },
      { metric: "domNodes", metrics: { domNodes: 1201 } },
      { metric: "tbtMs", metrics: { tbtMs: 601 } },
      { metric: "fcpMs", metrics: { fcpMs: 2001 } },
      { metric: "speedIndexMs", metrics: { speedIndexMs: 3501 } },
    ];

    for (const testCase of cases) {
      const evaluation = evaluateBudget({
        budget: PASSING_BUDGET,
        metrics: { ...PASSING_METRICS, ...testCase.metrics },
        metricsBudgets: GLOBAL_BUDGETS,
        limits: budget.limits,
      });
      const check = evaluation.checks.find(
        (entry) => entry.metric === testCase.metric,
      );
      expect(evaluation.pass, testCase.metric).toBe(false);
      expect(check?.pass, testCase.metric).toBe(false);
    }
  });

  it("lets a route override the global LCP and TBT caps", () => {
    const evaluation = evaluateBudget({
      budget: { ...PASSING_BUDGET, maxLcpMs: 2000, maxTbtMs: 100 },
      metrics: { ...PASSING_METRICS, lcpMs: 2100, tbtMs: 200 },
      metricsBudgets: { ...GLOBAL_BUDGETS, lcpMs: 4000, tbtMs: 600 },
      limits: budget.limits,
    });

    expect(evaluation.pass).toBe(false);
    expect(
      evaluation.checks.find((entry) => entry.metric === "lcpMs")?.limit,
    ).toBe(2000);
    expect(
      evaluation.checks.find((entry) => entry.metric === "tbtMs")?.limit,
    ).toBe(100);
  });

  it("fails closed when a declared metric was not measured", () => {
    const evaluation = evaluateBudget({
      budget: PASSING_BUDGET,
      metrics: { ...PASSING_METRICS, domNodes: null },
      metricsBudgets: GLOBAL_BUDGETS,
      limits: budget.limits,
    });

    const check = evaluation.checks.find(
      (entry) => entry.metric === "domNodes",
    );
    expect(evaluation.pass).toBe(false);
    expect(check?.actual).toBeNull();
    expect(describeFailure("/", check)).toContain("was not measured");
  });

  it("formats failure messages with units and without extra spaces", () => {
    expect(
      describeFailure("/admin (light)", {
        metric: "cls",
        label: "CLS",
        actual: 0.328,
        limit: 0.1,
        unit: "score",
        pass: false,
      }),
    ).toBe("/admin (light): CLS 0.328 exceeds 0.1");

    expect(
      describeFailure("/attempt (light)", {
        metric: "transferKb",
        label: "Transfer size",
        actual: 435.1,
        limit: 300,
        unit: "KB",
        pass: false,
      }),
    ).toBe("/attempt (light): Transfer size 435.1 KB exceeds 300 KB");

    expect(
      describeFailure("/", {
        metric: "lcpMs",
        label: "LCP",
        actual: null,
        limit: 4000,
        unit: "ms",
        pass: false,
      }),
    ).toBe("/: LCP was not measured (limit 4000 ms)");
  });
});

describe("performance budget configuration", () => {
  it("keeps live route keys and drops the retired mock-test hub", () => {
    expect(Object.keys(budget.routeBudgets).sort()).toEqual(
      [
        "/",
        "/admin",
        "/attempt/[id]",
        "/cuet-mock-test/english",
        "/mock-tests",
        "/mock/[slug]",
        "/mock/[slug]/instructions",
        "/q/[id]",
        "/result/[id]",
      ].sort(),
    );
    expect(budget.routeBudgets["/cuet-ug-mock-test"]).toBeUndefined();
  });

  it("declares a score, transfer cap and the global metric caps", () => {
    for (const [route, entry] of Object.entries(budget.routeBudgets)) {
      const routeBudget = entry as Record<string, unknown>;
      expect(routeBudget.targetScore, route).toEqual(expect.any(Number));
      expect(routeBudget.maxTransferKb, route).toEqual(expect.any(Number));
    }

    expect(budget.metrics.mobileSimulated4G).toMatchObject({
      lcpMs: 4000,
      tbtMs: 600,
      cls: 0.1,
      fcpMs: 2000,
      speedIndexMs: 3500,
    });
    expect(budget.limits.maxInitialDomNodes).toBe(1200);
  });

  it("guards the Lighthouse runner against the retired auth endpoint and ids", () => {
    const source = readFileSync(join(ROOT, "scripts/lighthouse-audit.mjs"), "utf8");

    expect(source).not.toContain("/api/auth/login");
    expect(source).not.toContain("mockId: 439");
    expect(source).not.toContain("/attempt/739");
    expect(source).not.toContain("/result/740");
    expect(source).not.toContain("lighthouse_guest_token_2026");
    expect(source).not.toContain("physics-2026-05-31-shift-2");

    expect(source).toContain("performance-budget.json");
    expect(source).toContain("matchRouteBudget");
    expect(source).toContain("evaluateBudget");
    expect(source).toContain('"dom-size-insight"');
    expect(source).toContain("process.exitCode = 1");
  });

  it("records the Lighthouse version and lets a caller pin the public question", () => {
    const source = readFileSync(join(ROOT, "scripts/lighthouse-audit.mjs"), "utf8");

    expect(source).toContain("raw.lighthouseVersion");
    expect(source).toContain("lighthouseVersions");
    expect(source).toContain("lighthouseVersion:");
    expect(source).toContain("LIGHTHOUSE_PUBLIC_QUESTION");
    expect(source).toContain("sitemapQuestionPath");
    // Fixtures are excluded from the sitemap, so the old e2e-preference filter
    // must not reappear and quietly audit a noindex page.
    expect(source).not.toContain("/\\/q\\/e2e-/i.test");
  });

  it("keeps session cookies out of the committed audit evidence", () => {
    const source = readFileSync(join(ROOT, "scripts/lighthouse-audit.mjs"), "utf8");

    expect(source).toContain("mkdtempSync");
    expect(source).toContain("readSanitizedReport");
    expect(source).not.toContain('join(OUTPUT_DIR, "headers');
  });
});

describe("performance regression guards", () => {
  it("marks admin JS before the sidebar can paint in normal flow", () => {
    const source = readFileSync(join(ROOT, "src/layouts/AdminLayout.astro"), "utf8");
    const headEnd = source.indexOf("</head>");
    const marker = source.indexOf('document.documentElement.dataset.adminJs = "true"');

    expect(headEnd).toBeGreaterThan(0);
    expect(marker).toBeGreaterThan(0);
    expect(marker).toBeLessThan(headEnd);
  });

  it("prerenders attempt share images on intent instead of page load", () => {
    const source = readFileSync(join(ROOT, "src/pages/attempt/[id].astro"), "utf8");

    expect(source).not.toContain("scheduleSharePrerender");
    expect(source).toContain("prerenderShareForTrigger");
    expect(source).toContain('"pointerover"');
    expect(source).toContain('"focusin"');
  });
});
