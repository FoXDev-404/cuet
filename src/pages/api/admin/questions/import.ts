import type { APIRoute } from "astro";
import { all } from "../../../../lib/db";
import { can } from "../../../../lib/auth/admin";
import { rateLimit } from "../../../../lib/auth/rate-limit";
import { requirePermission } from "../../../../lib/auth/guard";
import { audit } from "../../../../lib/audit";
import { questionPayloadSchema } from "../../../../lib/content";
import {
  insertQuestionBatch,
  listDuplicateCandidates,
  prepareQuestion,
  type DuplicateQuestionCandidate,
  type QuestionDbInput,
} from "../../../../lib/admin/questions";
import {
  importPreviewText,
  MAX_IMPORT_BYTES,
  normalizeImportRecord,
  parseQuestionImport,
  questionSignature,
  QuestionImportError,
  type ImportFormat,
} from "../../../../lib/admin/question-import";
import { apiError, forbiddenOrigin, isSameOrigin, json } from "../../../../lib/http";

type PreviewStatus = "valid" | "invalid" | "duplicate";

type PreviewRow = {
  row: number;
  status: PreviewStatus;
  errors: string[];
  text: string;
  subject_id: number | null;
  duplicate_of: number | null;
  duplicate_row: number | null;
  /** Original parsed row so rejected rows can be downloaded for correction. */
  source: Record<string, unknown>;
};

type ValidCandidate = {
  row: PreviewRow;
  input: QuestionDbInput;
};

const FORMATS: ImportFormat[] = ["auto", "csv", "json"];

export const POST: APIRoute = async (context) => {
  if (!isSameOrigin(context.request)) return forbiddenOrigin();
  const guard = requirePermission(context, "questions.write");
  if (guard.response) return guard.response;

  const limit = await rateLimit("question-import", String(guard.admin.id), 20, 60 * 60);
  if (!limit.allowed) return apiError("Too many imports. Try again later.", 429);

  let body: Record<string, unknown>;
  try {
    const parsed = (await context.request.json()) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return apiError("Invalid request body.");
    }
    body = parsed as Record<string, unknown>;
  } catch {
    return apiError("Invalid JSON body.");
  }

  const content = typeof body.content === "string" ? body.content : "";
  if (!content.trim()) return apiError("Paste or upload question data first.");
  if (new TextEncoder().encode(content).length > MAX_IMPORT_BYTES) {
    return apiError("The import file is larger than 1 MB.", 413);
  }

  const requestedFormat = String(body.format ?? "auto") as ImportFormat;
  if (!FORMATS.includes(requestedFormat)) return apiError("Choose CSV, JSON or auto-detect.");
  // Writes require an explicit dry_run:false. Preview is the safe default.
  const dryRun = body.dry_run !== false;

  let parsed: ReturnType<typeof parseQuestionImport>;
  try {
    parsed = parseQuestionImport(content, requestedFormat);
  } catch (error) {
    if (error instanceof QuestionImportError) return apiError(error.message);
    console.error("question import parse failed", error);
    return apiError("Could not parse the import file.");
  }

  const subjects = await all<{ id: number; name: string; slug: string }>(
    "SELECT id, name, slug FROM subjects WHERE is_active = 1 ORDER BY name",
  );
  const byId = new Map(subjects.map((subject) => [subject.id, subject]));
  const bySlug = new Map(subjects.map((subject) => [subject.slug.toLowerCase(), subject]));
  const byName = new Map(subjects.map((subject) => [subject.name.toLowerCase(), subject]));
  const canPublish = can(guard.admin.role, "questions.publish");

  function resolveSubject(ref: string | number | null): number | null {
    if (ref === null) return null;
    const raw = String(ref).trim();
    if (!raw) return null;
    if (/^\d+$/.test(raw)) {
      const id = Number(raw);
      return byId.has(id) ? id : null;
    }
    const key = raw.toLowerCase();
    return bySlug.get(key)?.id ?? byName.get(key)?.id ?? null;
  }

  const previews: PreviewRow[] = [];
  const candidates: ValidCandidate[] = [];
  const subjectIds = new Set<number>();

  for (const [index, record] of parsed.records.entries()) {
    const rowNumber = parsed.format === "csv" ? index + 2 : index + 1;
    const normalized = normalizeImportRecord(record);
    const subjectId = resolveSubject(normalized.subjectRef);
    const preview: PreviewRow = {
      row: rowNumber,
      status: "invalid",
      errors: [],
      text: importPreviewText(record),
      subject_id: subjectId,
      duplicate_of: null,
      duplicate_row: null,
      source: record,
    };
    previews.push(preview);

    if (!normalized.subjectRef) {
      preview.errors.push("Add subject_id or subject_slug.");
    } else if (subjectId === null) {
      preview.errors.push(`Unknown or inactive subject "${String(normalized.subjectRef)}".`);
    }

    const schema = questionPayloadSchema.safeParse({
      ...normalized.payload,
      subject_id: subjectId ?? normalized.payload.subject_id,
    });
    if (!schema.success) {
      for (const issue of schema.error.issues.slice(0, 4)) {
        const path = issue.path.join(".");
        preview.errors.push(path ? `${path}: ${issue.message}` : issue.message);
      }
    } else {
      if (schema.data.status !== "draft" && !canPublish) {
        preview.errors.push("Contributors can only import drafts. An editor must publish.");
      }
      if (preview.errors.length === 0) {
        const prepared = await prepareQuestion(schema.data);
        if ("error" in prepared) {
          preview.errors.push(prepared.error);
        } else {
          preview.status = "valid";
          candidates.push({ row: preview, input: prepared.input });
          subjectIds.add(prepared.input.subject_id);
        }
      }
    }
  }

  // Compare against current, non-superseded questions plus earlier rows in this
  // same file. Old immutable versions stay in D1 and must not block a correction.
  const existing = await listDuplicateCandidates([...subjectIds]);
  const existingBySubject = new Map<number, Map<string, DuplicateQuestionCandidate>>();
  for (const candidate of existing) {
    let signatures = existingBySubject.get(candidate.subject_id);
    if (!signatures) {
      signatures = new Map();
      existingBySubject.set(candidate.subject_id, signatures);
    }
    signatures.set(questionSignature(candidate.text), candidate);
  }

  const seen = new Map<string, number>();
  for (const candidate of candidates) {
    if (candidate.row.status !== "valid") continue;
    const key = `${candidate.input.subject_id}\u0000${questionSignature(candidate.input.text)}`;
    const duplicateRow = seen.get(key);
    if (duplicateRow) {
      candidate.row.status = "duplicate";
      candidate.row.errors.push(`Duplicate of row ${duplicateRow} in this file.`);
      candidate.row.duplicate_row = duplicateRow;
      continue;
    }
    const duplicate = existingBySubject
      .get(candidate.input.subject_id)
      ?.get(questionSignature(candidate.input.text));
    if (duplicate) {
      candidate.row.status = "duplicate";
      candidate.row.errors.push(
        `Duplicate of question #${duplicate.id} (${duplicate.status}) in this subject.`,
      );
      candidate.row.duplicate_of = duplicate.id;
      continue;
    }
    seen.set(key, candidate.row.row);
  }

  const summary = {
    total: previews.length,
    valid: previews.filter((row) => row.status === "valid").length,
    invalid: previews.filter((row) => row.status === "invalid").length,
    duplicate: previews.filter((row) => row.status === "duplicate").length,
  };

  if (dryRun) {
    return json({ ok: true, dry_run: true, format: parsed.format, rows: previews, summary });
  }

  if (summary.valid !== summary.total) {
    return json(
      {
        ok: false,
        error: "Fix invalid or duplicate rows before importing. Nothing was saved.",
        rows: previews,
        summary,
      },
      422,
    );
  }

  const validCandidates = candidates.filter((candidate) => candidate.row.status === "valid");
  try {
    const ids = await insertQuestionBatch(
      validCandidates.map((candidate) => candidate.input),
      guard.admin.id,
    );
    await audit({
      adminId: guard.admin.id,
      action: "question.import",
      entityType: "question",
      entityId: null,
      diff: {
        count: ids.length,
        ids,
        format: parsed.format,
        statuses: validCandidates.map((candidate) => candidate.input.status),
      },
    });
    return json(
      {
        ok: true,
        imported: ids.length,
        ids,
        redirect: "/admin/questions",
        summary,
      },
      201,
    );
  } catch (error) {
    console.error("question import failed", error);
    return apiError("The import failed and no rows were saved. Check the data and try again.", 500);
  }
};
