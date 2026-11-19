/**
 * Best-effort guard against oversized client bodies.
 *
 * This does not replace the rate limiter (a client may stream a chunked body
 * without sending Content-Length); it stops the common "huge literal body"
 * case before the platform buffers and parses it. Routes that legitimately
 * accept large payloads use a larger cap.
 */
export function bodyLimitExceeds(request: Request, maxBytes: number): boolean {
  const header = request.headers.get("content-length");
  if (!header) return false;
  const length = Number(header);
  return Number.isFinite(length) && length > maxBytes;
}
