const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export interface QuestionSource {
  source_year?: number | null;
  source_date?: string | null;
  source_shift?: string | null;
}

export interface PaperSourceFallback {
  year: number | null;
  date: string | null;
  shift: string | null;
}

export interface QuestionSourceTag {
  tag: string;
  year: number | null;
}

function displayDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day || month < 1 || month > 12) return null;
  return `${day} ${MONTHS[month - 1]} ${year}`;
}

/**
 * `PYQ - 15 May 2024, Shift 3`, then `PYQ - 2024` when the date or shift was
 * not printed, then `PYQ`. New set rows carry their own source fields; the 14
 * untouched papers fall back to the paper-level year/date/shift.
 */
export function questionSourceTag(
  question: QuestionSource,
  fallback?: PaperSourceFallback | null,
): QuestionSourceTag | null {
  const year = Number(question.source_year ?? fallback?.year ?? 0) || null;
  if (!year) return null;
  const date = displayDate(question.source_date ?? fallback?.date ?? null);
  const shift = (question.source_shift ?? fallback?.shift ?? "").trim();
  const datePart = date ?? String(year);
  const tag = shift ? `PYQ - ${datePart}, ${shift}` : `PYQ - ${datePart}`;
  return { tag, year };
}
