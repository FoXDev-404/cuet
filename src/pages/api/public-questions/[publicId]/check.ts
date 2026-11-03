import type { APIRoute } from "astro";
import { rateLimit } from "../../../../lib/auth/rate-limit";
import { apiError, clientIp, forbiddenOrigin, isSameOrigin, json } from "../../../../lib/http";
import { checkPublicQuestion } from "../../../../lib/share/public-question-store";

/**
 * Server-side answer check for a shared question. Eligibility is decided here:
 * a public-reveal practice question, or a signed-in user with a submitted
 * attempt containing the lineage. In-progress attempts and guests never see a
 * key on an attempted-only question.
 */
export const POST: APIRoute = async (context) => {
  if (!isSameOrigin(context.request)) return forbiddenOrigin();

  const publicId = context.params.publicId ?? "";
  const user = context.locals.user;
  const limit = await rateLimit(
    "public-question-check",
    user ? `u:${user.id}` : `ip:${clientIp(context.request)}`,
    30,
    60,
  );
  if (!limit.allowed) {
    return apiError("Too many answer checks. Wait a moment and try again.", 429);
  }

  let body: Record<string, unknown>;
  try {
    body = (await context.request.json()) as Record<string, unknown>;
  } catch {
    return apiError("Invalid JSON body.");
  }

  const option = Number(body.option);
  if (!Number.isInteger(option) || option < 0) {
    return apiError("Send the selected option index.", 400);
  }

  const result = await checkPublicQuestion(publicId, option, user?.id ?? null);
  if (!result.ok) {
    return json({ ok: false, error: result.error, cta: result.cta }, result.status);
  }

  return json({
    ok: true,
    correct: result.correct,
    correctOption: result.correctOption,
    explanationHtml: result.explanationHtml,
    explanationHiHtml: result.explanationHiHtml,
    explanationImageUrl: result.explanationImageUrl,
    explanationImageAlt: result.explanationImageAlt,
  });
};

export const prerender = false;
