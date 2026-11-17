/**
 * Shared performance-budget matching and evaluation.
 *
 * Used by scripts/lighthouse-audit.mjs and covered by unit tests. Keeping the
 * rules here (instead of inside the runner) makes the pass/fail decision
 * reviewable without launching a browser or Lighthouse.
 *
 * A route budget is matched by exact pathname first, then by a dynamic
 * pattern such as "/mock/[slug]". Dynamic patterns must have the same number
 * of path segments, so "/mock/[slug]" never matches "/mock/[slug]/instructions".
 */

/** Strip query/hash and trailing slashes. */
export function normalizePathname(pathname) {
  if (typeof pathname !== "string" || pathname.length === 0) return "/";
  const pathOnly = pathname.split(/[?#]/, 1)[0] || "/";
  const withLeadingSlash = pathOnly.startsWith("/") ? pathOnly : `/${pathOnly}`;
  if (withLeadingSlash.length > 1 && withLeadingSlash.endsWith("/")) {
    return withLeadingSlash.replace(/\/+$/, "") || "/";
  }
  return withLeadingSlash;
}

function segments(pathname) {
  return normalizePathname(pathname).split("/").filter(Boolean);
}

/**
 * Find the budget entry for a pathname.
 *
 * @param {Record<string, unknown>} routeBudgets
 * @param {string} pathname
 * @returns {{ pattern: string, budget: Record<string, unknown> } | null}
 */
export function matchRouteBudget(routeBudgets, pathname) {
  if (!routeBudgets || typeof routeBudgets !== "object") return null;
  const target = normalizePathname(pathname);

  for (const [pattern, budget] of Object.entries(routeBudgets)) {
    if (normalizePathname(pattern) === target) return { pattern, budget };
  }

  const targetSegments = segments(target);
  for (const [pattern, budget] of Object.entries(routeBudgets)) {
    const patternSegments = segments(pattern);
    if (patternSegments.length !== targetSegments.length) continue;

    const matches = patternSegments.every((segment, index) => {
      // [slug], [id], [questionId] — one or more non-slash characters.
      if (/^\[[^\]]+\]$/.test(segment)) return targetSegments[index].length > 0;
      return segment === targetSegments[index];
    });
    if (matches) return { pattern, budget };
  }

  return null;
}

function check(metric, label, actual, limit, unit, options = {}) {
  const limitNumber = Number(limit);
  const hasLimit = Number.isFinite(limitNumber);
  const measured =
    actual !== null && actual !== undefined && actual !== "" && Number.isFinite(Number(actual));
  const actualNumber = measured ? Number(actual) : null;

  if (!hasLimit) return null;

  // Fail closed: a budget was declared but Lighthouse did not report the
  // metric. Silently passing would let a broken audit hide a regression.
  const pass = measured
    ? options.minimum
      ? actualNumber >= limitNumber
      : actualNumber <= limitNumber
    : false;
  return {
    metric,
    label,
    actual: actualNumber,
    limit: limitNumber,
    unit,
    pass,
    required: options.required !== false,
    note: options.note,
  };
}

/**
 * Evaluate one route result against its route budget and the global caps.
 *
 * Route-specific maxLcpMs/maxTbtMs override the global metric caps.
 * maxInitialDomNodes is declared under `limits`; Lighthouse's `dom-size`
 * reports total DOM nodes, which is an upper bound for the initial count.
 *
 * @param {{
 *   budget?: Record<string, unknown> | null,
 *   metrics?: Record<string, number | null | undefined>,
 *   metricsBudgets?: Record<string, number | null | undefined>,
 *   limits?: Record<string, number | null | undefined>,
 * }} input
 * @returns {{ pass: boolean, checks: Array<Record<string, unknown>> }}
 */
export function evaluateBudget({ budget, metrics = {}, metricsBudgets = {}, limits = {} } = {}) {
  if (!budget) {
    return {
      pass: false,
      checks: [
        {
          metric: "budget",
          label: "Route budget",
          actual: null,
          limit: null,
          unit: "",
          pass: false,
          required: true,
          note: "No performance-budget.json entry matches this route.",
        },
      ],
    };
  }

  const routeLcp = budget.maxLcpMs ?? metricsBudgets.lcpMs;
  const routeTbt = budget.maxTbtMs ?? metricsBudgets.tbtMs;

  const checks = [
    check("performanceScore", "Performance score", metrics.performanceScore, budget.targetScore, "score", {
      minimum: true,
    }),
    check("transferKb", "Transfer size", metrics.transferKb, budget.maxTransferKb, "KB"),
    check("lcpMs", "LCP", metrics.lcpMs, routeLcp, "ms"),
    check("tbtMs", "TBT", metrics.tbtMs, routeTbt, "ms"),
    check("cls", "CLS", metrics.cls, metricsBudgets.cls, "score", { note: "unitless" }),
    check("fcpMs", "FCP", metrics.fcpMs, metricsBudgets.fcpMs, "ms"),
    check("speedIndexMs", "Speed Index", metrics.speedIndexMs, metricsBudgets.speedIndexMs, "ms"),
    check("domNodes", "Total DOM nodes", metrics.domNodes, limits.maxInitialDomNodes, "nodes", {
      note: "Upper bound for initial DOM nodes",
    }),
  ].filter(Boolean);

  return { pass: checks.every((entry) => entry.pass), checks };
}

function formatValue(value, unit) {
  // "score" is a unitless label (performance /100, CLS). Spacing the others
  // keeps messages readable instead of the old "0.328score" output.
  if (!unit || unit === "score") return String(value);
  return `${value} ${unit}`;
}

/** Human-readable one-line reason for a failed check. */
export function describeFailure(resultPath, check) {
  if (check.metric === "budget") {
    return `${resultPath}: no route budget defined`;
  }
  if (check.actual === null) {
    return `${resultPath}: ${check.label} was not measured (limit ${formatValue(check.limit, check.unit)})`;
  }
  return `${resultPath}: ${check.label} ${formatValue(check.actual, check.unit)} exceeds ${formatValue(check.limit, check.unit)}`;
}
