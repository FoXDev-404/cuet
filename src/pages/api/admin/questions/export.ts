import type { APIRoute } from "astro";
import { requirePermission } from "../../../../lib/auth/guard";
import { all } from "../../../../lib/db";
import { parseOptions } from "../../../../lib/content";
import { json } from "../../../../lib/http";

const STATUSES = new Set(["draft", "in_review", "published"]);
const MAX_ROWS = 5_000;

type ExportRow = {
  id: number;
  subject_id: number;
  subject_slug: string;
  topic_id: number | null;
  passage_id: number | null;
  text: string;
  text_hi: string | null;
  options: string;
  options_hi: string | null;
  correct_option: number;
  explanation: string | null;
  explanation_hi: string | null;
  difficulty: string | null;
  year: number | null;
  image_url: string | null;
  image_alt: string | null;
  explanation_image_url: string | null;
  explanation_image_alt: string | null;
  status: string;
};

const CSV_HEADERS = [
  "id",
  "subject_id",
  "subject_slug",
  "topic_id",
  "passage_id",
  "text",
  "text_hi",
  "option_a",
  "option_a_image_url",
  "option_a_image_alt",
  "option_b",
  "option_b_image_url",
  "option_b_image_alt",
  "option_c",
  "option_c_image_url",
  "option_c_image_alt",
  "option_d",
  "option_d_image_url",
  "option_d_image_alt",
  "option_e",
  "option_e_image_url",
  "option_e_image_alt",
  "option_f",
  "option_f_image_url",
  "option_f_image_alt",
  "options_hi",
  "correct_option",
  "explanation",
  "explanation_hi",
  "difficulty",
  "year",
  "image_url",
  "image_alt",
  "explanation_image_url",
  "explanation_image_alt",
  "status",
];

function csvCell(value: unknown): string {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function optionColumns(options: ReturnType<typeof parseOptions>): Record<string, string> {
  const fields: Record<string, string> = {};
  const letters = ["a", "b", "c", "d", "e", "f"] as const;
  for (const [index, letter] of letters.entries()) {
    const option = options[index];
    fields[`option_${letter}`] = option?.text ?? "";
    fields[`option_${letter}_image_url`] = option?.image_url ?? "";
    fields[`option_${letter}_image_alt`] = option?.alt ?? "";
  }
  return fields;
}

/**
 * Admin-only question export. CSV uses the same flat fields as the importer so
 * an exported file can be corrected and re-imported without translation.
 */
export const GET: APIRoute = async (context) => {
  const guard = requirePermission(context, "questions.write");
  if (guard.response) return guard.response;

  const url = new URL(context.request.url);
  const format = (url.searchParams.get("format") ?? "csv").toLowerCase();
  if (format !== "csv" && format !== "json") {
    return json({ ok: false, error: "Choose csv or json format." }, 400);
  }

  const status = (url.searchParams.get("status") ?? "").trim();
  const subject = Number(url.searchParams.get("subject") ?? "");
  const topic = Number(url.searchParams.get("topic") ?? "");
  const requestedYear = Number(url.searchParams.get("year") ?? "");
  const year =
    Number.isInteger(requestedYear) && requestedYear >= 2000 && requestedYear <= 2100
      ? requestedYear
      : 0;
  const query = (url.searchParams.get("q") ?? "").trim().slice(0, 100);

  const where = ["q.deleted_at IS NULL"];
  const params: (string | number)[] = [];
  if (STATUSES.has(status)) {
    where.push("q.status = ?");
    params.push(status);
  }
  if (Number.isInteger(subject) && subject > 0) {
    where.push("q.subject_id = ?");
    params.push(subject);
  }
  if (Number.isInteger(topic) && topic > 0) {
    where.push("q.topic_id = ?");
    params.push(topic);
  }
  if (year > 0) {
    where.push("q.year = ?");
    params.push(year);
  }
  if (query) {
    where.push("q.text LIKE ? ESCAPE '\\'");
    params.push(`%${query.replace(/[\\%_]/g, "\\$&")}%`);
  }

  const rows = await all<ExportRow>(
    `SELECT q.id, q.subject_id, s.slug AS subject_slug, q.topic_id, q.passage_id,
            q.text, q.text_hi, q.options, q.options_hi, q.correct_option,
            q.explanation, q.explanation_hi, q.difficulty, q.year,
            q.image_url, q.image_alt, q.explanation_image_url, q.explanation_image_alt,
            q.status
     FROM questions q JOIN subjects s ON s.id = q.subject_id
     WHERE ${where.join(" AND ")}
     ORDER BY q.id DESC
     LIMIT ${MAX_ROWS}`,
    ...params,
  );

  const stamp = new Date().toISOString().slice(0, 10);
  const filename = `cuet-questions-${stamp}.${format}`;
  const headers = {
    "content-type": format === "csv" ? "text/csv; charset=utf-8" : "application/json; charset=utf-8",
    "content-disposition": `attachment; filename="${filename}"`,
    "cache-control": "no-store",
    "x-robots-tag": "noindex, nofollow",
  };

  if (format === "json") {
    return new Response(
      JSON.stringify(
        rows.map((row) => {
          const options = parseOptions(row.options);
          return {
            id: row.id,
            subject_id: row.subject_id,
            subject_slug: row.subject_slug,
            topic_id: row.topic_id,
            passage_id: row.passage_id,
            text: row.text,
            text_hi: row.text_hi,
            options,
            options_hi: row.options_hi ? parseOptions(row.options_hi) : [],
            correct_option: row.correct_option,
            explanation: row.explanation,
            explanation_hi: row.explanation_hi,
            difficulty: row.difficulty,
            year: row.year,
            image_url: row.image_url,
            image_alt: row.image_alt,
            explanation_image_url: row.explanation_image_url,
            explanation_image_alt: row.explanation_image_alt,
            status: row.status,
          };
        }),
        null,
        2,
      ),
      { headers },
    );
  }

  const lines = [CSV_HEADERS.join(",")];
  for (const row of rows) {
    const fields: Record<string, unknown> = {
      id: row.id,
      subject_id: row.subject_id,
      subject_slug: row.subject_slug,
      topic_id: row.topic_id,
      passage_id: row.passage_id,
      text: row.text,
      text_hi: row.text_hi,
      ...optionColumns(parseOptions(row.options)),
      options_hi: row.options_hi ?? "",
      correct_option: row.correct_option,
      explanation: row.explanation,
      explanation_hi: row.explanation_hi,
      difficulty: row.difficulty,
      year: row.year,
      image_url: row.image_url,
      image_alt: row.image_alt,
      explanation_image_url: row.explanation_image_url,
      explanation_image_alt: row.explanation_image_alt,
      status: row.status,
    };
    lines.push(CSV_HEADERS.map((header) => csvCell(fields[header])).join(","));
  }

  return new Response(`\uFEFF${lines.join("\r\n")}\r\n`, { headers });
};
