/**
 * Bulk question import parsing. This module is intentionally pure: it turns a
 * JSON or CSV payload into raw question records and leaves subject lookup,
 * schema validation and database checks to the API route.
 */

export const MAX_IMPORT_ROWS = 100;
export const MAX_IMPORT_BYTES = 1_000_000;

export type ImportFormat = "auto" | "csv" | "json";
export type ResolvedImportFormat = Exclude<ImportFormat, "auto">;
export type ImportRecord = Record<string, unknown>;

export type NormalizedImportRecord = {
  payload: Record<string, unknown>;
  subjectRef: string | number | null;
};

export class QuestionImportError extends Error {}

const OPTION_LETTERS = ["a", "b", "c", "d", "e", "f"] as const;

function value(record: ImportRecord, key: string): unknown {
  return record[key] ?? null;
}

function firstValue(record: ImportRecord, keys: string[]): unknown {
  for (const key of keys) {
    const item = record[key];
    if (item !== null && item !== undefined && String(item).trim() !== "") return item;
  }
  return null;
}

function textValue(record: ImportRecord, key: string): string {
  const item =
    key === "text"
      ? firstValue(record, ["text", "question_text", "question"])
      : value(record, key);
  if (item === null || item === undefined) return "";
  return String(item);
}

function nullableText(record: ImportRecord, key: string): string | null {
  const item = textValue(record, key).trim();
  return item || null;
}

export function normalizeImportHeader(header: string): string {
  return header
    .replace(/^\uFEFF/, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

/** Canonical duplicate key: case, Unicode width and whitespace are ignored. */
export function questionSignature(text: string): string {
  return text.normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim();
}

/** RFC 4180-style CSV parser with quoted commas, escaped quotes and newlines. */
export function parseCsvCells(input: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  const pushCell = () => {
    row.push(cell);
    cell = "";
  };
  const pushRow = () => {
    pushCell();
    rows.push(row);
    row = [];
  };

  for (let index = 0; index < input.length; index += 1) {
    const character = input[index]!;
    if (quoted) {
      if (character === '"') {
        if (input[index + 1] === '"') {
          cell += '"';
          index += 1;
        } else {
          quoted = false;
        }
      } else {
        cell += character;
      }
      continue;
    }

    if (character === '"' && cell.length === 0) {
      quoted = true;
    } else if (character === ",") {
      pushCell();
    } else if (character === "\n") {
      pushRow();
    } else if (character === "\r") {
      if (input[index + 1] === "\n") index += 1;
      pushRow();
    } else {
      cell += character;
    }
  }

  if (quoted) throw new QuestionImportError("CSV has an unclosed quoted field.");

  // Preserve a final row that was not terminated by a newline.
  if (cell.length > 0 || row.length > 0) pushRow();

  return rows;
}

function parseCsvRecords(content: string): ImportRecord[] {
  const rows = parseCsvCells(content);
  if (rows.length === 0) throw new QuestionImportError("The CSV file is empty.");

  const headerRow = rows[0]!;
  const headers = headerRow.map(normalizeImportHeader);
  if (headers.every((header) => !header)) {
    throw new QuestionImportError("The CSV file needs a header row.");
  }
  if (headers.some((header) => !header)) {
    throw new QuestionImportError("Every CSV column needs a name in the header row.");
  }

  const seen = new Set<string>();
  for (const header of headers) {
    if (seen.has(header)) {
      throw new QuestionImportError(`The CSV header "${header}" appears more than once.`);
    }
    seen.add(header);
  }

  const records: ImportRecord[] = [];
  for (let rowIndex = 1; rowIndex < rows.length; rowIndex += 1) {
    const cells = rows[rowIndex]!;
    if (cells.every((cell) => cell.trim() === "")) continue;
    const record: ImportRecord = {};
    for (let column = 0; column < headers.length; column += 1) {
      record[headers[column]!] = cells[column] ?? "";
    }
    records.push(record);
  }

  if (records.length === 0) {
    throw new QuestionImportError("The CSV file has a header but no question rows.");
  }
  return records;
}

function parseJsonRecords(content: string): ImportRecord[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content.replace(/^\uFEFF/, ""));
  } catch {
    throw new QuestionImportError("The JSON file is not valid JSON.");
  }

  const list = Array.isArray(parsed)
    ? parsed
    : parsed && typeof parsed === "object" && Array.isArray((parsed as { questions?: unknown }).questions)
      ? (parsed as { questions: unknown[] }).questions
      : null;
  if (!list) {
    throw new QuestionImportError("JSON must be an array of questions or an object with a questions array.");
  }
  if (list.length === 0) throw new QuestionImportError("The JSON file has no questions.");
  if (list.some((item) => !item || typeof item !== "object" || Array.isArray(item))) {
    throw new QuestionImportError("Every JSON question must be an object.");
  }
  return list as ImportRecord[];
}

export function detectImportFormat(content: string): ResolvedImportFormat {
  const trimmed = content.replace(/^\uFEFF/, "").trimStart();
  return trimmed.startsWith("[") || trimmed.startsWith("{") ? "json" : "csv";
}

export type ParsedQuestionImport = {
  format: ResolvedImportFormat;
  records: ImportRecord[];
};

export function parseQuestionImport(
  content: string,
  format: ImportFormat = "auto",
): ParsedQuestionImport {
  if (!content.trim()) throw new QuestionImportError("Paste or upload question data first.");
  if (new TextEncoder().encode(content).length > MAX_IMPORT_BYTES) {
    throw new QuestionImportError("The import file is larger than 1 MB.");
  }

  const resolvedFormat = format === "auto" ? detectImportFormat(content) : format;
  const records = resolvedFormat === "json" ? parseJsonRecords(content) : parseCsvRecords(content);
  if (records.length > MAX_IMPORT_ROWS) {
    throw new QuestionImportError(`Import at most ${MAX_IMPORT_ROWS} questions at a time.`);
  }
  return { format: resolvedFormat, records };
}

function parseCorrectOption(raw: unknown): unknown {
  if (typeof raw === "number") return raw;
  if (raw === null || raw === undefined) return null;
  const trimmed = String(raw).trim();
  if (!trimmed) return null;
  if (/^[a-f]$/i.test(trimmed)) return trimmed.toUpperCase().charCodeAt(0) - 65;
  if (/^\d+$/.test(trimmed)) return Number(trimmed);
  return trimmed;
}

function parseOptionsCell(raw: unknown): unknown {
  if (Array.isArray(raw)) return raw;
  if (typeof raw !== "string" || !raw.trim()) return null;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return raw;
  }
}

function flatOptions(record: ImportRecord): unknown[] {
  let lastFilled = -1;
  const options = OPTION_LETTERS.map((letter, index) => {
    const option = {
      text: textValue(record, `option_${letter}`),
      image_url: nullableText(record, `option_${letter}_image_url`),
      alt: nullableText(record, `option_${letter}_image_alt`),
    };
    if (option.text.trim() || option.image_url) lastFilled = index;
    return option;
  });
  // Keep at least two entries so the shared validator can produce a useful
  // "add at least two options" message instead of a generic schema failure.
  return options.slice(0, Math.max(2, lastFilled + 1));
}

/**
 * Convert a JSON-native question or a flat CSV/JSON row into the shared
 * question payload shape. Unknown extra columns are ignored by the schema.
 */
export function normalizeImportRecord(record: ImportRecord): NormalizedImportRecord {
  const subjectId = value(record, "subject_id");
  const subjectSlug = value(record, "subject_slug");
  const subject = firstValue(record, ["subject", "subject_name"]);
  const subjectRef =
    subjectId !== null && String(subjectId).trim() !== ""
      ? String(subjectId).trim()
      : subjectSlug !== null && String(subjectSlug).trim() !== ""
        ? String(subjectSlug).trim()
        : subject !== null
          ? String(subject).trim()
          : null;

  const nativeOptions = parseOptionsCell(value(record, "options"));
  const options = Array.isArray(nativeOptions) ? nativeOptions : flatOptions(record);

  const payload: Record<string, unknown> = {
    subject_id: subjectRef,
    topic_id: value(record, "topic_id"),
    passage_id: value(record, "passage_id"),
    text: textValue(record, "text"),
    text_hi: nullableText(record, "text_hi"),
    options,
    options_hi: Array.isArray(value(record, "options_hi"))
      ? value(record, "options_hi")
      : (() => {
          const parsed = parseOptionsCell(value(record, "options_hi"));
          return Array.isArray(parsed) ? parsed : [];
        })(),
    correct_option: parseCorrectOption(value(record, "correct_option")),
    explanation: nullableText(record, "explanation"),
    explanation_hi: nullableText(record, "explanation_hi"),
    difficulty: nullableText(record, "difficulty"),
    year: value(record, "year"),
    image_url: nullableText(record, "image_url"),
    image_alt: nullableText(record, "image_alt"),
    explanation_image_url: nullableText(record, "explanation_image_url"),
    explanation_image_alt: nullableText(record, "explanation_image_alt"),
    status: textValue(record, "status").trim().toLowerCase() || "draft",
  };

  return { payload, subjectRef };
}

export function importPreviewText(record: ImportRecord): string {
  const text = textValue(record, "text").replace(/\s+/g, " ").trim();
  return text.length > 140 ? `${text.slice(0, 137)}...` : text;
}
