import {
  SHARE_CARD_MAX_HEIGHT,
  SHARE_CARD_MIN_HEIGHT,
  SHARE_CARD_WIDTH,
  choosePixelRatio,
  clampShareCardHeight,
  type ShareLanguage,
} from "./share-message";

/**
 * Client-only share-card renderer.
 *
 * A dedicated 1080px card is rendered off-screen and exported with
 * `html-to-image` (lazy-loaded on the first share tap). The component owns the
 * markup; this module only measures, truncates and serialises it. Nothing here
 * touches server CPU, and the card never receives user identity.
 */

export type ShareCardOptions = {
  language: ShareLanguage;
  includeAnswer: boolean;
};

const QUESTION_FONT_SIZES = [40, 34, 28] as const;

function nextFrame(): Promise<void> {
  if (typeof requestAnimationFrame !== "function") return Promise.resolve();
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}

function setLanguage(card: HTMLElement, language: ShareLanguage): void {
  card.querySelectorAll<HTMLElement>("[data-share-lang]").forEach((node) => {
    node.hidden = node.dataset.shareLang !== language;
  });
}

function setAnswer(card: HTMLElement, includeAnswer: boolean): void {
  const answer = card.querySelector<HTMLElement>("[data-share-answer]");
  if (!answer) return;

  answer.hidden = !includeAnswer;
  answer.style.removeProperty("max-height");
  answer.style.removeProperty("overflow");

  const correctOption = Number(card.dataset.correctOption ?? "-1");
  card.querySelectorAll<HTMLElement>("[data-share-option]").forEach((row) => {
    const isCorrect =
      includeAnswer && Number(row.dataset.shareOption) === correctOption;
    row.classList.toggle("is-correct", isCorrect);
  });
}

async function waitForImages(card: HTMLElement): Promise<void> {
  const images = [...card.querySelectorAll<HTMLImageElement>("img")];
  await Promise.all(
    images.map(async (image) => {
      if (!image.complete) {
        await new Promise<void>((resolve) => {
          image.addEventListener("load", () => resolve(), { once: true });
          image.addEventListener("error", () => resolve(), { once: true });
        });
      }
      try {
        await image.decode();
      } catch {
        // A broken or cross-origin image must not block the export. The
        // caller hides images that failed to decode before measuring.
      }
    }),
  );
}

async function settle(card: HTMLElement): Promise<void> {
  if (typeof document !== "undefined" && document.fonts?.ready) {
    try {
      await document.fonts.ready;
    } catch {
      // Font loading is best-effort; system fallbacks still render.
    }
  }
  await waitForImages(card);

  card.querySelectorAll<HTMLImageElement>("img").forEach((image) => {
    if (image.complete && image.naturalWidth === 0) image.hidden = true;
  });
}

/**
 * Applies the active language and answer state, shrinks long questions down to
 * the 28px floor, then clamps the card to 1080–1920px. The footer is outside
 * the clipped main area, so the link stays visible even when the question is
 * truncated.
 */
export async function prepareShareCard(
  card: HTMLElement,
  options: ShareCardOptions,
): Promise<{ width: number; height: number }> {
  setLanguage(card, options.language);
  setAnswer(card, options.includeAnswer);
  await settle(card);

  const main = card.querySelector<HTMLElement>("[data-share-main]");
  const question = card.querySelector<HTMLElement>("[data-share-question]");
  const truncated = card.querySelector<HTMLElement>("[data-share-truncated]");
  const answer = card.querySelector<HTMLElement>("[data-share-answer]");

  card.style.height = "auto";
  card.style.minHeight = "0px";
  card.style.maxHeight = "none";
  card.style.overflow = "visible";
  if (question) {
    question.style.removeProperty("max-height");
    question.style.removeProperty("overflow");
  }
  if (truncated) truncated.hidden = true;
  if (answer && options.includeAnswer) {
    answer.style.removeProperty("max-height");
    answer.style.removeProperty("overflow");
  }

  let naturalHeight = SHARE_CARD_MIN_HEIGHT;
  for (const size of QUESTION_FONT_SIZES) {
    card.style.setProperty("--share-question-size", `${size}px`);
    card.style.setProperty("--share-option-size", `${Math.max(24, size - 6)}px`);
    await nextFrame();
    naturalHeight = card.scrollHeight;
    if (naturalHeight <= SHARE_CARD_MAX_HEIGHT) break;
  }

  const height = clampShareCardHeight(naturalHeight);
  card.style.height = `${height}px`;
  card.style.minHeight = `${height}px`;
  card.style.maxHeight = `${height}px`;
  card.style.overflow = "hidden";
  await nextFrame();

  if (naturalHeight > SHARE_CARD_MAX_HEIGHT && main && question) {
    if (truncated) truncated.hidden = false;
    await nextFrame();
    const overflow = Math.max(0, main.scrollHeight - main.clientHeight);
    if (overflow > 0) {
      const current = question.getBoundingClientRect().height;
      question.style.maxHeight = `${Math.max(120, current - overflow - 8)}px`;
      question.style.overflow = "hidden";
    }
  }

  if (options.includeAnswer && answer) {
    // A very long explanation must not push the URL out of the export.
    answer.style.maxHeight = "420px";
    answer.style.overflow = "hidden";
  }

  await nextFrame();
  return { width: SHARE_CARD_WIDTH, height };
}

function isIosSafari(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return /iP(hone|ad|od)/.test(ua) || (ua.includes("Macintosh") && "ontouchend" in document);
}

/**
 * Returns a PNG Blob at 1080px wide (2x when the bitmap stays within the pixel
 * cap). iOS Safari occasionally exports a blank first frame after a fresh
 * font/image decode, so it renders twice and keeps the second result.
 */
export async function renderShareCardPng(
  card: HTMLElement,
  options: ShareCardOptions,
): Promise<{ blob: Blob; width: number; height: number }> {
  const { width, height } = await prepareShareCard(card, options);
  const { toBlob } = await import("html-to-image");

  const deviceMemory = (
    navigator as Navigator & { deviceMemory?: number }
  ).deviceMemory;
  const pixelRatio = choosePixelRatio(width, height, deviceMemory);
  const background =
    getComputedStyle(card).backgroundColor || "transparent";

  const render = () =>
    toBlob(card, {
      width,
      height,
      pixelRatio,
      backgroundColor: background,
      cacheBust: true,
      style: {
        position: "static",
        left: "0",
        top: "0",
        margin: "0",
        width: `${width}px`,
        height: `${height}px`,
        maxHeight: `${height}px`,
      },
    });

  let blob = await render();
  if (isIosSafari()) {
    const second = await render();
    if (second) blob = second;
  }

  if (!blob) {
    throw new Error("The browser could not create the share image.");
  }
  return { blob, width, height };
}
