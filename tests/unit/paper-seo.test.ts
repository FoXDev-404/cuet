import { describe, expect, it } from "vitest";
import {
  paperSeoTitle,
  paperSetLabel,
  rankedPaperMetaDescription,
} from "../../src/lib/seo-content";

const rebuilt = {
  subjectName: "Chemistry",
  dateLabel: "2026",
  shift: null,
  sourceMethod: "pyq_rebuild_pooled",
  isGeneralTest: false,
};

describe("PYQ set pages have unique search metadata", () => {
  it("recognises the set number only for rebuilt papers", () => {
    expect(
      paperSetLabel({ title: "CUET Chemistry PYQ Set 15", sourceMethod: "pyq_rebuild_pooled" }),
    ).toBe("PYQ Set 15");
    expect(
      paperSetLabel({
        title: "CUET UG Chemistry 21 May 2025 Shift 2 Previous Year Paper",
        sourceMethod: "PaddleOCR-VL",
      }),
    ).toBeNull();
  });

  it("puts the set number in rebuilt paper titles", () => {
    const set15 = paperSeoTitle({ ...rebuilt, paperTitle: "CUET Chemistry PYQ Set 15" });
    const set16 = paperSeoTitle({ ...rebuilt, paperTitle: "CUET Chemistry PYQ Set 16" });
    expect(set15).toContain("Set 15");
    expect(set16).toContain("Set 16");
    expect(set15).not.toBe(set16);
    expect(set15.length).toBeLessThanOrEqual(65);
    expect(set16.length).toBeLessThanOrEqual(65);
  });

  it("keeps the date and shift title for original papers", () => {
    expect(
      paperSeoTitle({
        subjectName: "Chemistry",
        dateLabel: "21 May 2025",
        shift: "Shift 2",
        paperTitle: "CUET UG Chemistry 21 May 2025 Shift 2 Previous Year Paper",
        sourceMethod: "PaddleOCR-VL",
      }),
    ).toBe("CUET Chemistry 21 May 2025 Shift 2 Paper | CUET Mock");
  });

  it("keeps rebuilt general-test titles distinct", () => {
    const set16 = paperSeoTitle({
      subjectName: "General Test",
      dateLabel: "2025–2026",
      shift: null,
      paperTitle: "CUET General Test PYQ Set 16",
      sourceMethod: "pyq_rebuild_pooled",
      isGeneralTest: true,
    });
    const set17 = paperSeoTitle({
      subjectName: "General Test",
      dateLabel: "2025–2026",
      shift: null,
      paperTitle: "CUET General Test PYQ Set 17",
      sourceMethod: "pyq_rebuild_pooled",
      isGeneralTest: true,
    });
    expect(set16).toContain("Set 16");
    expect(set17).toContain("Set 17");
    expect(set16).not.toBe(set17);
  });

  it("keeps rebuilt set titles for short subjects above 35 characters", () => {
    for (const subjectName of ["History", "Physics", "English", "Biology", "Hindi"]) {
      const title = paperSeoTitle({
        ...rebuilt,
        subjectName,
        paperTitle: `CUET ${subjectName} PYQ Set 1`,
      });
      expect(title.length, title).toBeGreaterThanOrEqual(35);
      expect(title.length, title).toBeLessThanOrEqual(65);
      expect(title).toContain("Set 1");
    }
  });

  it("puts the set number in rebuilt meta descriptions", () => {
    const set15 = rankedPaperMetaDescription({
      dateLabel: "2026",
      subject: "Chemistry",
      questionCount: 50,
      durationMinutes: 50,
      setLabel: "PYQ Set 15",
    });
    const set16 = rankedPaperMetaDescription({
      dateLabel: "2026",
      subject: "Chemistry",
      questionCount: 50,
      durationMinutes: 50,
      setLabel: "PYQ Set 16",
    });
    expect(set15).toContain("PYQ Set 15");
    expect(set16).toContain("PYQ Set 16");
    expect(set15).not.toBe(set16);
    expect(set15.length).toBeGreaterThanOrEqual(120);
    expect(set15.length).toBeLessThanOrEqual(160);
  });
});
