import { describe, expect, it } from "vitest";
import {
  SECTION_TIME_ALLOCATIONS,
  calculateMockDuration,
  getSectionFamily,
} from "../../src/lib/exam-timing";

describe("CUET UG Section-Wise Time Allocation & Mock Timer", () => {
  it("defines the exact official 3-section time allocation table", () => {
    expect(SECTION_TIME_ALLOCATIONS).toHaveLength(3);

    const [language, domain, general] = SECTION_TIME_ALLOCATIONS;
    expect(language.sectionPaper).toBe("Language Papers (Section IA & IB)");
    expect(language.totalQuestionsLabel).toBe("50 compulsory questions");
    expect(language.totalDurationLabel).toBe("60 minutes");
    expect(language.standardQuestions).toBe(50);
    expect(language.standardDurationMin).toBe(60);
    expect(language.secondsPerQuestion).toBe(72);
    expect(language.minutesPerQuestion).toBe(1.2);
    expect(language.timePerQuestionLabel).toBe("1.2 minutes (72 seconds)");

    expect(domain.sectionPaper).toBe("Standard Domain Subjects");
    expect(domain.totalQuestionsLabel).toBe("50 compulsory questions");
    expect(domain.totalDurationLabel).toBe("60 minutes");
    expect(domain.standardQuestions).toBe(50);
    expect(domain.standardDurationMin).toBe(60);
    expect(domain.secondsPerQuestion).toBe(72);
    expect(domain.minutesPerQuestion).toBe(1.2);
    expect(domain.timePerQuestionLabel).toBe("1.2 minutes (72 seconds)");

    expect(general.sectionPaper).toBe("General Aptitude Test (Section III)");
    expect(general.totalQuestionsLabel).toBe("60 questions");
    expect(general.totalDurationLabel).toBe("60 minutes");
    expect(general.standardQuestions).toBe(60);
    expect(general.standardDurationMin).toBe(60);
    expect(general.secondsPerQuestion).toBe(60);
    expect(general.minutesPerQuestion).toBe(1.0);
    expect(general.timePerQuestionLabel).toBe("1.0 minute (60 seconds)");
  });

  it("identifies subject section families accurately", () => {
    expect(getSectionFamily("English")).toBe("language");
    expect(getSectionFamily("Hindi")).toBe("language");
    expect(getSectionFamily("Physics")).toBe("domain");
    expect(getSectionFamily("Chemistry")).toBe("domain");
    expect(getSectionFamily("Mathematics")).toBe("domain");
    expect(getSectionFamily("Biology")).toBe("domain");
    expect(getSectionFamily("History")).toBe("domain");
    expect(getSectionFamily("Geography")).toBe("domain");
    expect(getSectionFamily("General Test")).toBe("general");
    expect(getSectionFamily("General Aptitude")).toBe("general");
  });

  it("calculates mock duration dynamically based on question count for Language and Domain (72s/q)", () => {
    // 50 compulsory questions = 60 minutes
    const fullEnglish = calculateMockDuration(50, "English");
    expect(fullEnglish.durationMinutes).toBe(60);
    expect(fullEnglish.durationSeconds).toBe(3600);

    const fullPhysics = calculateMockDuration(50, "Physics");
    expect(fullPhysics.durationMinutes).toBe(60);
    expect(fullPhysics.durationSeconds).toBe(3600);

    // 10 questions = 12 minutes (720 seconds)
    const tenQuestions = calculateMockDuration(10, "Physics");
    expect(tenQuestions.durationMinutes).toBe(12);
    expect(tenQuestions.durationSeconds).toBe(720);

    // 25 questions = 30 minutes (1800 seconds)
    const twentyFive = calculateMockDuration(25, "Chemistry");
    expect(twentyFive.durationMinutes).toBe(30);
    expect(twentyFive.durationSeconds).toBe(1800);

    // 40 questions = 48 minutes (2880 seconds)
    const forty = calculateMockDuration(40, "English");
    expect(forty.durationMinutes).toBe(48);
    expect(forty.durationSeconds).toBe(2880);

    // 8 questions = 10 minutes (576 seconds rounded)
    const eight = calculateMockDuration(8, "Mathematics");
    expect(eight.durationMinutes).toBe(10);
    expect(eight.durationSeconds).toBe(576);
  });

  it("calculates mock duration dynamically based on question count for General Test (60s/q)", () => {
    // 60 questions = 60 minutes
    const fullGeneral = calculateMockDuration(60, "General Test");
    expect(fullGeneral.durationMinutes).toBe(60);
    expect(fullGeneral.durationSeconds).toBe(3600);

    // 50 questions = 50 minutes
    const fiftyGeneral = calculateMockDuration(50, "General Test");
    expect(fiftyGeneral.durationMinutes).toBe(50);
    expect(fiftyGeneral.durationSeconds).toBe(3000);

    // 15 questions = 15 minutes
    const fifteenGeneral = calculateMockDuration(15, "General Test");
    expect(fifteenGeneral.durationMinutes).toBe(15);
    expect(fifteenGeneral.durationSeconds).toBe(900);
  });
});
