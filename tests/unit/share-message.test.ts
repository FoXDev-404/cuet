import { describe, expect, it } from "vitest";
import {
  SHARE_CARD_MAX_HEIGHT,
  SHARE_CARD_MIN_HEIGHT,
  choosePixelRatio,
  clampShareCardHeight,
  normalizeShareLanguage,
  shareFileName,
  shareMessage,
  shareMockMessage,
  telegramShareUrl,
  whatsappShareUrl,
} from "../../src/lib/share/share-message";

describe("share copy and fallback URLs", () => {
  it("uses the exact English and Hindi prompts", () => {
    expect(normalizeShareLanguage("hi")).toBe("hi");
    expect(normalizeShareLanguage("en")).toBe("en");
    expect(normalizeShareLanguage("fr")).toBe("en");

    const url = "https://example.test/q/example-AAAAAAAAAA";
    expect(shareMessage("en", url)).toBe(
      `Can you solve this CUET question? ${url}`,
    );
    expect(shareMessage("hi", url)).toBe(
      `क्या आप यह CUET प्रश्न हल कर सकते हैं? ${url}`,
    );
  });

  it("encodes WhatsApp and Telegram links without attempt or user data", () => {
    const url = "https://example.test/q/example-AAAAAAAAAA";
    const message = shareMessage("en", url);
    const whatsapp = whatsappShareUrl(message);
    expect(whatsapp.startsWith("https://wa.me/?text=")).toBe(true);
    expect(decodeURIComponent(whatsapp.split("text=")[1]!)).toBe(message);

    const telegram = telegramShareUrl(url, "Can you solve this CUET question?");
    const parsed = new URL(telegram);
    expect(parsed.origin + parsed.pathname).toBe("https://t.me/share/url");
    expect(parsed.searchParams.get("url")).toBe(url);
    expect(parsed.searchParams.get("text")).toBe(
      "Can you solve this CUET question?",
    );
    expect(telegram).not.toContain("attempt");
    expect(telegram).not.toContain("user");
  });

  it("builds the exact live-attempt mock prompt", () => {
    expect(shareMockMessage("https://example.test/mock/demo/instructions")).toBe(
      "I'm practising this CUET mock: https://example.test/mock/demo/instructions",
    );
  });

  it("builds a stable public filename", () => {
    expect(shareFileName("AbCdEf1234")).toBe("cuet-question-AbCdEf1234.png");
  });

  it("clamps the card height to the documented range", () => {
    expect(clampShareCardHeight(0)).toBe(SHARE_CARD_MIN_HEIGHT);
    expect(clampShareCardHeight(1080)).toBe(1080);
    expect(clampShareCardHeight(1500.4)).toBe(1500);
    expect(clampShareCardHeight(5000)).toBe(SHARE_CARD_MAX_HEIGHT);
    expect(clampShareCardHeight(Number.NaN)).toBe(SHARE_CARD_MIN_HEIGHT);
  });

  it("exports at 2x only within the pixel cap and memory hint", () => {
    expect(choosePixelRatio(1080, 1080, undefined)).toBe(2);
    expect(choosePixelRatio(1080, 1500, 8)).toBe(2);
    expect(choosePixelRatio(1080, 1500, 2)).toBe(1);
    expect(choosePixelRatio(1080, 1920, undefined)).toBe(1);
    expect(choosePixelRatio(1080, 1920, 8)).toBe(1);
  });
});
