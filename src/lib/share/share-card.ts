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

/** Never let a stalled network request (tunnel, weak mobile link) hang the
 * export: every best-effort wait is capped and degrades gracefully. */
const IMAGE_WAIT_MS = 5_000;
const DECODE_WAIT_MS = 2_000;
const FONTS_WAIT_MS = 3_000;
const IMAGE_EMBED_TIMEOUT_MS = 10_000;

function withTimeout(promise: Promise<unknown>, ms: number): Promise<void> {
  return new Promise<void>((resolve) => {
    const timer = setTimeout(() => resolve(), ms);
    promise.then(
      () => {
        clearTimeout(timer);
        resolve();
      },
      () => {
        clearTimeout(timer);
        resolve();
      },
    );
  });
}

async function waitForImages(card: HTMLElement): Promise<void> {
  const images = [...card.querySelectorAll<HTMLImageElement>("img")];
  await Promise.all(
    images.map(async (image) => {
      if (!image.complete) {
        await withTimeout(
          new Promise<void>((resolve) => {
            image.addEventListener("load", () => resolve(), { once: true });
            image.addEventListener("error", () => resolve(), { once: true });
          }),
          IMAGE_WAIT_MS,
        );
      }
      try {
        await withTimeout(image.decode(), DECODE_WAIT_MS);
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
      await withTimeout(document.fonts.ready, FONTS_WAIT_MS);
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
 * Embedding the web fonts (KaTeX alone ships ~20 faces) is by far the slowest
 * part of the export: html-to-image would fetch and base64-encode every font
 * on every render, which on a phone over a slow link looks like a hang.
 * scripts/generate-share-fonts.mjs bakes those @font-face rules with data-URI
 * sources into two lazy JSON files — base text fonts (always needed) and
 * KaTeX faces (only when the question actually contains math) — so a render
 * needs zero font network work beyond one small cached download.
 */
const fontCache = new Map<string, Promise<string>>();

const FONT_FETCH_TIMEOUT_MS = 12_000;

function fetchFontJson(name: string): Promise<string> {
  // A stalled fetch (flaky tunnel, weak mobile link) must never hang the
  // render: cap it, then let html-to-image's own embedding take over — and
  // drop the cache entry so the next open retries the fast path.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FONT_FETCH_TIMEOUT_MS);
  return fetch(`/share-fonts-${name}.json`, { signal: controller.signal })
    .then((response) => (response.ok ? response.json() : Promise.reject(new Error(`missing ${name}`))))
    .then((value: unknown) => {
      const data = value as { css?: string };
      return data.css ?? "";
    })
    .catch(() => {
      fontCache.delete(name);
      return "";
    })
    .finally(() => clearTimeout(timer));
}

function loadFontJson(name: string): Promise<string> {
  const existing = fontCache.get(name);
  if (existing) return existing;
  const promise = fetchFontJson(name);
  fontCache.set(name, promise);
  return promise;
}

async function fontEmbedCSS(card: HTMLElement): Promise<string> {
  const base = await loadFontJson("base");
  if (!card.querySelector(".katex")) return base;
  const math = await loadFontJson("math");
  return math ? `${base}\n${math}` : base;
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
  const marks =
    typeof performance !== "undefined" && typeof performance.mark === "function"
      ? performance.mark.bind(performance)
      : null;
  marks?.("share-card:start");
  const { width, height } = await prepareShareCard(card, options);
  const { toBlob } = await import("html-to-image");
  marks?.("share-card:prepared");

  const deviceMemory = (
    navigator as Navigator & { deviceMemory?: number }
  ).deviceMemory;
  const pixelRatio = choosePixelRatio(width, height, deviceMemory);
  const background =
    getComputedStyle(card).backgroundColor || "transparent";
  // No cacheBust: media URLs are immutable, and busting the cache would force
  // the browser to refetch every font and figure over the network per render.
  const fontCSS = await fontEmbedCSS(card);
  marks?.("share-card:fonts");

  const render = () => {
    // Figure fetches inside html-to-image must not hang the export either:
    // abort them after a generous window and let the render degrade.
    const controller = new AbortController();
    const fetchTimer = setTimeout(() => controller.abort(), IMAGE_EMBED_TIMEOUT_MS);
    return toBlob(card, {
      width,
      height,
      pixelRatio,
      backgroundColor: background,
      fontEmbedCSS: fontCSS || undefined,
      fetchRequestInit: { signal: controller.signal },
      style: {
        position: "static",
        left: "0",
        top: "0",
        margin: "0",
        width: `${width}px`,
        height: `${height}px`,
        maxHeight: `${height}px`,
      },
    }).finally(() => clearTimeout(fetchTimer));
  };

  let blob = await render();
  marks?.("share-card:rendered");
  if (isIosSafari()) {
    const second = await render();
    if (second) blob = second;
  }

  if (!blob) {
    throw new Error("The browser could not create the share image.");
  }
  if (marks) {
    performance.measure("share:prepare", "share-card:start", "share-card:prepared");
    performance.measure("share:fonts", "share-card:prepared", "share-card:fonts");
    performance.measure("share:render", "share-card:fonts", "share-card:rendered");
  }
  return { blob, width, height };
}
