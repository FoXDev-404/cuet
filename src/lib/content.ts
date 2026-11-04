import { z } from "zod";
import { renderPlainText, renderRichText } from "./rich-text";

export { renderPlainText, renderRichText };

export type QuestionOption = {
  text: string;
  image_url: string | null;
  alt: string | null;
};

export const EMPTY_OPTION: QuestionOption = { text: "", image_url: null, alt: null };

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90);
}

export function parseOptions(raw: string | null | undefined): QuestionOption[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((item) => {
      const record = (item ?? {}) as Record<string, unknown>;
      return {
        text: typeof record.text === "string" ? record.text : "",
        image_url: typeof record.image_url === "string" ? record.image_url : null,
        alt: typeof record.alt === "string" ? record.alt : null,
      };
    });
  } catch {
    return [];
  }
}

export function normalizeOptions(options: QuestionOption[]): QuestionOption[] {
  const cleaned = options.map((option) => ({
    text: option.text.trim(),
    image_url: option.image_url?.trim() || null,
    alt: option.alt?.trim() || null,
  }));
  while (cleaned.length < 4) cleaned.push({ ...EMPTY_OPTION });
  return cleaned;
}

function nullableString(max: number) {
  return z
    .string()
    .max(max)
    .nullable()
    .optional()
    .transform((value) => (typeof value === "string" && value.trim() ? value.trim() : null));
}

function optionalInteger() {
  return z
    .union([z.string(), z.number(), z.null(), z.undefined()])
    .optional()
    .transform((value) => {
      if (value === null || value === undefined || value === "") return null;
      const number = Number(value);
      return Number.isFinite(number) ? Math.trunc(number) : Number.NaN;
    })
    .pipe(z.number().int().positive().nullable());
}

export const questionPayloadSchema = z.object({
  subject_id: z.coerce.number().int().positive(),
  topic_id: optionalInteger(),
  passage_id: optionalInteger(),
  text: z.string().trim().min(1).max(20_000),
  text_hi: nullableString(20_000),
  options: z
    .array(
      z.object({
        text: z.string().max(5_000).default(""),
        image_url: nullableString(500),
        alt: nullableString(300),
      }),
    )
    .min(2)
    .max(6),
  options_hi: z
    .array(
      z.object({
        text: z.string().max(5_000).default(""),
        image_url: nullableString(500),
        alt: nullableString(300),
      }),
    )
    .optional()
    .default([]),
  correct_option: z.coerce.number().int().min(0),
  explanation: nullableString(30_000),
  explanation_hi: nullableString(30_000),
  difficulty: z.enum(["easy", "medium", "hard"]).nullable().optional(),
  year: optionalInteger(),
  image_url: nullableString(500),
  image_alt: nullableString(300),
  explanation_image_url: nullableString(500),
  explanation_image_alt: nullableString(300),
  status: z.enum(["draft", "in_review", "published"]).default("draft"),
});

export type QuestionPayload = z.infer<typeof questionPayloadSchema>;

export function validateQuestionContent(question: QuestionPayload): string[] {
  const errors: string[] = [];
  const options = normalizeOptions(question.options);
  const populated = options.filter((option) => option.text || option.image_url);

  if (populated.length < 2) errors.push("Add at least two options.");
  if (question.correct_option >= options.length) {
    errors.push("The correct option is outside the option list.");
  } else if (!options[question.correct_option]?.text && !options[question.correct_option]?.image_url) {
    errors.push("The correct option cannot be empty.");
  }

  const images = [
    { url: question.image_url, alt: question.image_alt, label: "question image" },
    { url: question.explanation_image_url, alt: question.explanation_image_alt, label: "explanation image" },
    ...options.map((option, index) => ({
      url: option.image_url,
      alt: option.alt,
      label: `option ${String.fromCharCode(65 + index)} image`,
    })),
  ];
  for (const image of images) {
    if (image.url && !image.alt) errors.push(`Alt text is required for the ${image.label}.`);
  }

  if (question.status === "published") {
    if (!question.explanation) errors.push("A published question needs an explanation.");
    for (const [index, option] of options.entries()) {
      if (option.image_url && !option.alt) {
        errors.push(`Option ${String.fromCharCode(65 + index)} image needs alt text.`);
      }
    }
  }

  return errors;
}

export function parseMarkingScheme(raw: string): {
  correct: number;
  wrong: number;
  skipped: number;
  sections?: Record<string, { correct: number; wrong: number; skipped: number }>;
} {
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const correct = Number(parsed.correct);
    const wrong = Number(parsed.wrong);
    const skipped = Number(parsed.skipped ?? 0);
    if (![correct, wrong, skipped].every(Number.isFinite)) throw new Error("invalid");

    let sections: Record<string, { correct: number; wrong: number; skipped: number }> | undefined;
    if (parsed.sections && typeof parsed.sections === "object") {
      sections = {};
      for (const [secName, secScheme] of Object.entries(parsed.sections as Record<string, unknown>)) {
        if (secScheme && typeof secScheme === "object") {
          const s = secScheme as Record<string, unknown>;
          const sCorrect = Number(s.correct);
          const sWrong = Number(s.wrong);
          const sSkipped = Number(s.skipped ?? 0);
          if ([sCorrect, sWrong, sSkipped].every(Number.isFinite)) {
            sections[secName] = { correct: sCorrect, wrong: sWrong, skipped: sSkipped };
          }
        }
      }
    }
    return { correct, wrong, skipped, ...(sections && Object.keys(sections).length > 0 ? { sections } : {}) };
  } catch {
    return { correct: 5, wrong: -1, skipped: 0 };
  }
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

export function formatDuration(totalSeconds: number | null | undefined): string {
  const seconds = Math.max(0, Math.round(Number(totalSeconds ?? 0)));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = seconds % 60;
  if (hours > 0) return `${hours}h ${minutes}m ${rest}s`;
  if (minutes > 0) return `${minutes}m ${rest}s`;
  return `${rest}s`;
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}
