/**
 * Pure copy and URL helpers for the share sheet. Keeping these separate makes
 * the encoded fallback URLs and the pixel-ratio cap unit-testable without a
 * browser.
 */

export type ShareLanguage = "en" | "hi";

export const SHARE_CARD_WIDTH = 1080;
export const SHARE_CARD_MIN_HEIGHT = 1080;
export const SHARE_CARD_MAX_HEIGHT = 1920;

/** The output PNG is capped so low-memory phones can still export it. */
export const SHARE_CARD_MAX_PIXELS = 8_000_000;

const SHARE_PROMPTS: Record<ShareLanguage, string> = {
  en: "Can you solve this CUET question?",
  hi: "क्या आप यह CUET प्रश्न हल कर सकते हैं?",
};

export function normalizeShareLanguage(value: unknown): ShareLanguage {
  return value === "hi" ? "hi" : "en";
}

/** Sentence without the URL, used as the native share title. */
export function sharePrompt(language: ShareLanguage): string {
  return SHARE_PROMPTS[language];
}

/** Default text posted to WhatsApp/native share, matching the prompt spec. */
export function shareMessage(language: ShareLanguage, url: string): string {
  return `${sharePrompt(language)} ${url}`;
}

/** The live-attempt surface shares only the mock link, never a question. */
export function shareMockMessage(url: string): string {
  return `I'm practising this CUET mock: ${url}`;
}

export function shareMockTitle(): string {
  return "CUET mock test";
}

export function whatsappShareUrl(message: string): string {
  return `https://wa.me/?text=${encodeURIComponent(message)}`;
}

export function telegramShareUrl(url: string, prompt: string): string {
  return `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(prompt)}`;
}

/** A stable filename; the public id is safe to expose. */
export function shareFileName(publicId: string): string {
  return `cuet-question-${publicId}.png`;
}

export function clampShareCardHeight(height: number): number {
  if (!Number.isFinite(height)) return SHARE_CARD_MIN_HEIGHT;
  return Math.min(
    SHARE_CARD_MAX_HEIGHT,
    Math.max(SHARE_CARD_MIN_HEIGHT, Math.round(height)),
  );
}

/**
 * Export at 2x only when the resulting bitmap stays inside the pixel cap and
 * the device is not explicitly memory constrained. `deviceMemory` is a
 * Chromium-only hint, so callers may pass undefined.
 */
export function choosePixelRatio(
  width: number,
  height: number,
  deviceMemory?: number | null,
): 1 | 2 {
  if (deviceMemory != null && deviceMemory < 4) return 1;
  return width * height * 4 <= SHARE_CARD_MAX_PIXELS ? 2 : 1;
}
