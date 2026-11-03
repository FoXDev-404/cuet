import type { APIRoute } from "astro";
import { apiError, json } from "../../../lib/http";
import { resolvePublicQuestion } from "../../../lib/share/public-question-store";

/**
 * Public question JSON. The correct option and explanation are deliberately
 * absent; only the check endpoint can reveal them to an eligible viewer.
 */
export const GET: APIRoute = async (context) => {
  const publicId = context.params.publicId ?? "";
  const resolved = await resolvePublicQuestion(publicId, context.locals.user?.id ?? null);
  if (!resolved) return apiError("Question not found.", 404);

  const mock = resolved.view.relatedMocks[0];
  return json({
    ok: true,
    question: resolved.view,
    cta: resolved.view.canCheck
      ? null
      : mock
        ? { href: `/mock/${mock.slug}/instructions`, label: "Attempt this mock" }
        : { href: "/cuet-ug-mock-test", label: "Browse CUET mock tests" },
  });
};

export const prerender = false;
