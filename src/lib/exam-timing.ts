/**
 * Official CUET UG Section-Wise Time Allocation rules.
 *
 * | Section / Paper                    | Total Questions          | Total Duration | Time Per Question          |
 * |:-----------------------------------|:-------------------------|:---------------|:---------------------------|
 * | Language Papers (Section IA & IB)  | 50 compulsory questions  | 60 minutes     | 1.2 minutes (72 seconds)   |
 * | Standard Domain Subjects           | 50 compulsory questions  | 60 minutes     | 1.2 minutes (72 seconds)   |
 * | General Aptitude Test (Section III)| 60 questions             | 60 minutes     | 1.0 minute (60 seconds)    |
 */

export type ExamSectionFamily = "language" | "domain" | "general";

export interface TimeAllocationRule {
  sectionPaper: string;
  family: ExamSectionFamily;
  totalQuestionsLabel: string;
  totalDurationLabel: string;
  standardQuestions: number;
  standardDurationMin: number;
  minutesPerQuestion: number;
  secondsPerQuestion: number;
  timePerQuestionLabel: string;
}

export const SECTION_TIME_ALLOCATIONS: readonly TimeAllocationRule[] = [
  {
    sectionPaper: "Language Papers (Section IA & IB)",
    family: "language",
    totalQuestionsLabel: "50 compulsory questions",
    totalDurationLabel: "60 minutes",
    standardQuestions: 50,
    standardDurationMin: 60,
    minutesPerQuestion: 1.2,
    secondsPerQuestion: 72,
    timePerQuestionLabel: "1.2 minutes (72 seconds)",
  },
  {
    sectionPaper: "Standard Domain Subjects",
    family: "domain",
    totalQuestionsLabel: "50 compulsory questions",
    totalDurationLabel: "60 minutes",
    standardQuestions: 50,
    standardDurationMin: 60,
    minutesPerQuestion: 1.2,
    secondsPerQuestion: 72,
    timePerQuestionLabel: "1.2 minutes (72 seconds)",
  },
  {
    sectionPaper: "General Aptitude Test (Section III)",
    family: "general",
    totalQuestionsLabel: "60 questions",
    totalDurationLabel: "60 minutes",
    standardQuestions: 60,
    standardDurationMin: 60,
    minutesPerQuestion: 1.0,
    secondsPerQuestion: 60,
    timePerQuestionLabel: "1.0 minute (60 seconds)",
  },
] as const;

export function getSectionFamily(subjectName?: string | null): ExamSectionFamily {
  if (!subjectName) return "domain";
  const lower = subjectName.toLowerCase();
  if (lower.includes("general") || lower.includes("aptitude")) return "general";
  if (
    lower.includes("english") ||
    lower.includes("hindi") ||
    lower.includes("language") ||
    lower.includes("sanskrit") ||
    lower.includes("urdu")
  ) {
    return "language";
  }
  return "domain";
}

export function getRatePerQuestion(subjectName?: string | null): {
  minutesPerQuestion: number;
  secondsPerQuestion: number;
  label: string;
  family: ExamSectionFamily;
} {
  const family = getSectionFamily(subjectName);
  const rule = SECTION_TIME_ALLOCATIONS.find((r) => r.family === family) ?? SECTION_TIME_ALLOCATIONS[1];
  return {
    minutesPerQuestion: rule.minutesPerQuestion,
    secondsPerQuestion: rule.secondsPerQuestion,
    label: rule.timePerQuestionLabel,
    family,
  };
}

export function calculateMockDuration(
  questionCount: number,
  subjectName?: string | null,
): {
  durationMinutes: number;
  durationSeconds: number;
  secondsPerQuestion: number;
  label: string;
} {
  const rate = getRatePerQuestion(subjectName);
  if (questionCount <= 0) {
    return {
      durationMinutes: 60,
      durationSeconds: 3600,
      secondsPerQuestion: rate.secondsPerQuestion,
      label: rate.label,
    };
  }
  const durationSeconds = questionCount * rate.secondsPerQuestion;
  const durationMinutes = Math.max(1, Math.round(durationSeconds / 60));
  return {
    durationMinutes,
    durationSeconds,
    secondsPerQuestion: rate.secondsPerQuestion,
    label: rate.label,
  };
}
