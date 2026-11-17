export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

export function apiError(message: string, status = 400): Response {
  return json({ error: message }, status);
}

export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (origin) {
    try {
      return new URL(origin).host === new URL(request.url).host;
    } catch {
      return false;
    }
  }
  // Browsers send Origin on state-changing fetch/XHR calls. Some same-origin
  // requests omit it and expose Sec-Fetch-Site instead, which must be exactly
  // "same-origin" ("same-site" is a different origin). A request with neither
  // header is not a browser cross-site request we can trust, so fail closed
  // instead of letting any non-browser client skip the CSRF check.
  return request.headers.get("sec-fetch-site") === "same-origin";
}

export function forbiddenOrigin(): Response {
  return apiError("Cross-origin request blocked.", 403);
}

export function clientIp(request: Request): string {
  return (
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown"
  );
}

export function redirect(location: string, status = 303): Response {
  return new Response(null, { status, headers: { location } });
}

export function safeNext(value: string | null | undefined, fallback = "/dashboard"): string {
  if (!value) return fallback;
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return fallback;
  return value;
}

/** Add or replace a query parameter without turning a relative path absolute. */
export function withQuery(path: string, key: string, value: string): string {
  const url = new URL(path, "https://internal.invalid");
  url.searchParams.set(key, value);
  return `${url.pathname}${url.search}${url.hash}`;
}
