import type { APIRoute } from "astro";
import { rateLimit } from "../../../../lib/auth/rate-limit";
import { parseOptions } from "../../../../lib/content";
import { all } from "../../../../lib/db";
import { apiError, forbiddenOrigin, isSameOrigin, json } from "../../../../lib/http";
import { imageDimensionsForUrls } from "../../../../lib/media-dimensions";

type RetryRow = {
  id: number;
  options: string;
  correct_option: number;
  explanation: string | null;
  explanation_hi: string | null;
  explanation_image_url: string | null;
  explanation_image_alt: string | null;
};

export const POST: APIRoute = async (context) => {
  if (!isSameOrigin(context.request)) return forbiddenOrigin();
  const user = context.locals.user;
  if (!user) return apiError("Login required.", 401);

  const limit = await rateLimit("wrong-question-retry", String(user.id), 20, 60 * 60);
  if (!limit.allowed) return apiError("Too many retry submissions. Try again later.", 429);

  let body: Record<string, unknown>;
  try {
    body = (await context.request.json()) as Record<string, unknown>;
  } catch {
    return apiError("Invalid request body.");
  }

  const answers = body.answers;
  if (!Array.isArray(answers) || answers.length === 0) {
    return apiError("Submit at least one answer.");
  }
  if (answers.length > 50) return apiError("Submit at most 50 answers at a time.");

  const requested = new Map<number, number | null>();
  for (const entry of answers) {
    const record = (entry ?? {}) as Record<string, unknown>;
    const questionId = Number(record.question_id);
    if (!Number.isInteger(questionId) || questionId <= 0) {
      return apiError("One of the questions is invalid.");
    }
    const raw = record.selected;
    const selected =
      raw === null || raw === undefined || raw === "" ? null : Number(raw);
    if (selected !== null && (!Number.isInteger(selected) || selected < 0 || selected > 9)) {
      return apiError("One of the selected options is invalid.");
    }
    requested.set(questionId, selected);
  }

  const ids = [...requested.keys()];
  const placeholders = ids.map(() => "?").join(",");
  const rows = await all<RetryRow>(
    `SELECT DISTINCT q.id, q.options, q.correct_option, q.explanation, q.explanation_hi,
            q.explanation_image_url, q.explanation_image_alt
     FROM attempt_answers aa
     JOIN attempts a ON a.id = aa.attempt_id
     JOIN questions q ON q.id = aa.question_id
     WHERE a.user_id = ? AND a.status IN ('submitted', 'expired')
       AND aa.selected IS NOT NULL AND aa.is_correct = 0
       AND q.deleted_at IS NULL AND q.id IN (${placeholders})`,
    user.id,
    ...ids,
  );
  if (rows.length !== ids.length) {
    return apiError("This retry only accepts questions you previously answered incorrectly.", 403);
  }

  for (const row of rows) {
    const selected = requested.get(row.id) ?? null;
    const options = parseOptions(row.options);
    if (selected !== null && selected >= options.length) {
      return apiError("One of the selected options is invalid.");
    }
  }

  const dimensions = await imageDimensionsForUrls(
    rows.map((row) => row.explanation_image_url),
  );

  const results = rows.map((row) => {
    const selected = requested.get(row.id) ?? null;
    return {
      question_id: row.id,
      selected,
      correct_option: row.correct_option,
      is_correct: selected === null ? null : selected === row.correct_option,
      explanation: row.explanation,
      explanation_hi: row.explanation_hi,
      explanation_image_url: row.explanation_image_url,
      explanation_image_alt: row.explanation_image_alt,
      explanation_image_width: row.explanation_image_url
        ? dimensions.get(row.explanation_image_url)?.width ?? null
        : null,
      explanation_image_height: row.explanation_image_url
        ? dimensions.get(row.explanation_image_url)?.height ?? null
        : null,
    };
  });

  return json({ ok: true, count: results.length, results });
};
