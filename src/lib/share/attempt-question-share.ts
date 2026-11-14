import { renderShareCardPng } from "./share-card";
import { recordShareEvent } from "./record-share-event";
import {
  normalizeShareLanguage,
  shareMessage,
  sharePrompt,
  telegramShareUrl,
  whatsappShareUrl,
  type ShareLanguage,
} from "./share-message";
import { attemptShareFileName, attemptShareLinkText } from "./attempt-question";

/**
 * Live-attempt question share sheet.
 *
 * Renders the current question into a 1080px "window" card (three traffic-light
 * dots + the mock title in the title bar) and exports it with html-to-image.
 * The card never receives the correct option, the candidate's selection or any
 * scoring data — the attempt payload does not contain them. Opening the sheet
 * only overlays the page, so the timer and autosave keep running.
 */

export type AttemptShareOption = {
  text: string;
  rendered_text?: string;
  image_url: string | null;
  alt: string | null;
};

export type AttemptShareQuestion = {
  id: number;
  /** 1-based number exactly as shown in the attempt header. */
  number: number;
  section: string;
  text: string;
  text_hi: string | null;
  rendered_text?: string;
  rendered_text_hi?: string | null;
  options: AttemptShareOption[];
  options_hi: AttemptShareOption[];
  image_url: string | null;
  image_alt: string | null;
  passage: {
    body: string;
    body_hi: string | null;
    rendered_body?: string;
    rendered_body_hi?: string | null;
    image_url: string | null;
    image_alt: string | null;
  } | null;
};

export type AttemptShareRequest = {
  question: AttemptShareQuestion;
  language: ShareLanguage | "en" | "hi";
  mockId: number;
  mockTitle: string;
  mockSlug: string;
  /** Absolute link the shared card points at. */
  shareUrl: string;
  publicId: string | null;
};

type SheetElements = {
  root: HTMLElement | null;
  dialog: HTMLElement | null;
  backdrop: HTMLElement | null;
  close: HTMLButtonElement | null;
  card: HTMLElement | null;
  preview: HTMLImageElement | null;
  previewLoading: HTMLElement | null;
  native: HTMLButtonElement | null;
  whatsapp: HTMLAnchorElement | null;
  telegram: HTMLAnchorElement | null;
  copy: HTMLButtonElement | null;
  download: HTMLButtonElement | null;
  error: HTMLElement | null;
  status: HTMLElement | null;
};

function elements(): SheetElements {
  const root = document.querySelector<HTMLElement>("[data-attempt-share-sheet]");
  return {
    root,
    dialog: root?.querySelector<HTMLElement>("[data-attempt-share-dialog]") ?? null,
    backdrop: root?.querySelector<HTMLElement>("[data-attempt-share-backdrop]") ?? null,
    close: root?.querySelector<HTMLButtonElement>("[data-attempt-share-close]") ?? null,
    card: root?.querySelector<HTMLElement>("[data-attempt-share-card]") ?? null,
    preview: root?.querySelector<HTMLImageElement>("[data-attempt-share-preview]") ?? null,
    previewLoading: root?.querySelector<HTMLElement>("[data-attempt-share-loading]") ?? null,
    native: root?.querySelector<HTMLButtonElement>("[data-attempt-share-native]") ?? null,
    whatsapp: root?.querySelector<HTMLAnchorElement>("[data-attempt-share-whatsapp]") ?? null,
    telegram: root?.querySelector<HTMLAnchorElement>("[data-attempt-share-telegram]") ?? null,
    copy: root?.querySelector<HTMLButtonElement>("[data-attempt-share-copy]") ?? null,
    download: root?.querySelector<HTMLButtonElement>("[data-attempt-share-download]") ?? null,
    error: root?.querySelector<HTMLElement>("[data-attempt-share-error]") ?? null,
    status: root?.querySelector<HTMLElement>("[data-attempt-share-status]") ?? null,
  };
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    const map: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return map[character] ?? character;
  });
}

function escapeAttr(value: string | null | undefined): string {
  return escapeHtml((value ?? "").replace(/"/g, "&quot;"));
}

const OPTION_LETTERS = ["A", "B", "C", "D", "E", "F"];

/**
 * Builds the card DOM. Rich-text fragments are pre-rendered (sanitized) HTML
 * from the server payload; plain text is escaped here. The structure reuses
 * the data attributes `prepareShareCard` measures (`data-share-main`,
 * `data-share-question`, `data-share-truncated`, `data-share-lang`) so the
 * font-shrink ladder and 1080–1920px height clamp apply unchanged.
 */
function buildCard(el: SheetElements, request: AttemptShareRequest): void {
  const card = el.card;
  if (!card) return;
  const question = request.question;
  const language = normalizeShareLanguage(request.language);
  const questionEn = question.rendered_text?.trim() || escapeHtml(question.text);
  const questionHi =
    (language === "hi" || question.text_hi?.trim()) && question.rendered_text_hi?.trim()
      ? question.rendered_text_hi
      : question.text_hi?.trim()
        ? escapeHtml(question.text_hi)
        : null;

  const passage = question.passage;
  const passageMarkup = passage
    ? `<div class="asq-passage">
        <p class="asq-block-label">Passage</p>
        <div class="asq-passage-body">
          <div data-share-lang="en">${passage.rendered_body?.trim() || escapeHtml(passage.body)}</div>
          ${passage.rendered_body_hi?.trim() || passage.body_hi?.trim() ? `<div data-share-lang="hi" lang="hi" hidden>${passage.rendered_body_hi?.trim() || escapeHtml(passage.body_hi ?? "")}</div>` : ""}
        </div>
        ${passage.image_url ? `<img class="asq-image" src="${escapeAttr(passage.image_url)}" alt="${escapeAttr(passage.image_alt) || "Passage figure"}" />` : ""}
      </div>`
    : "";

  const imageMarkup = question.image_url
    ? `<img class="asq-image" src="${escapeAttr(question.image_url)}" alt="${escapeAttr(question.image_alt) || "Question figure"}" />`
    : "";

  const optionsMarkup = question.options
    .map((option, index) => {
      const hindi = question.options_hi[index];
      const bodyEn = option.rendered_text?.trim() || (option.text ? escapeHtml(option.text) : "");
      const hindiBody =
        hindi?.rendered_text?.trim() ||
        (hindi?.text?.trim() ? escapeHtml(hindi.text) : null);
      const image = option.image_url
        ? `<img class="asq-option-image" src="${escapeAttr(option.image_url)}" alt="${escapeAttr(option.alt) || `Option ${OPTION_LETTERS[index] ?? index + 1}`}" />`
        : "";
      const hindiImage =
        hindi?.image_url && hindi.image_url !== option.image_url
          ? `<img class="asq-option-image" data-share-lang="hi" hidden src="${escapeAttr(hindi.image_url)}" alt="${escapeAttr(hindi.alt) || `Option ${OPTION_LETTERS[index] ?? index + 1} in Hindi`}" />`
          : "";
      const bodyHtml = bodyEn
        ? `<div data-share-lang="en">${bodyEn}</div>${hindiBody ? `<div data-share-lang="hi" lang="hi" hidden>${hindiBody}</div>` : ""}${image}${hindiImage}`
        : `${image}${hindiImage}` || `<span class="asq-option-empty">Option ${OPTION_LETTERS[index] ?? index + 1}</span>`;
      return `<li class="asq-option">
        <span class="asq-letter" aria-hidden="true">${OPTION_LETTERS[index] ?? index + 1}</span>
        <span class="asq-option-body">${bodyHtml}</span>
      </li>`;
    })
    .join("");

  card.innerHTML = `
    <header class="asq-titlebar">
      <span class="asq-dots" aria-hidden="true"><i class="asq-dot"></i><i class="asq-dot"></i><i class="asq-dot"></i></span>
      <p class="asq-title">${escapeHtml(request.mockTitle)}</p>
    </header>
    <main class="asq-main" data-share-main>
      <div class="asq-meta">
        <span class="asq-chip">Question ${question.number}</span>
        <span class="asq-chip asq-chip-muted">${escapeHtml(question.section)}</span>
      </div>
      ${passageMarkup}
      <div class="asq-question" data-share-question>
        <div data-share-lang="en">${questionEn}</div>
        ${questionHi ? `<div data-share-lang="hi" lang="hi" hidden>${questionHi}</div>` : ""}
      </div>
      ${imageMarkup}
      <ul class="asq-options">${optionsMarkup}</ul>
      <p class="asq-truncated" data-share-truncated hidden>
        <span data-share-lang="en">Read the full question at the link.</span>
        <span data-share-lang="hi" lang="hi" hidden>पूरा प्रश्न लिंक पर पढ़ें।</span>
      </p>
    </main>
    <footer class="asq-footer">
      <p class="asq-brand">CUET Free Mock Test</p>
      <p class="asq-url">${escapeHtml(attemptShareLinkText(request.shareUrl))}</p>
    </footer>
  `;
}

type SheetState = {
  open: boolean;
  lastFocus: HTMLElement | null;
  bodyOverflow: string;
  blob: Blob | null;
  previewUrl: string;
  cacheKey: string;
  failedKey: string;
  generating: boolean;
  generation: Promise<void> | null;
  statusRevision: number;
  wired: boolean;
  current: AttemptShareRequest | null;
};

const state: SheetState = {
  open: false,
  lastFocus: null,
  bodyOverflow: "",
  blob: null,
  previewUrl: "",
  cacheKey: "",
  failedKey: "",
  generating: false,
  generation: null,
  statusRevision: 0,
  wired: false,
  current: null,
};

function focusableItems(dialog: HTMLElement): HTMLElement[] {
  return [...dialog.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])')].filter(
    (node) => !node.hidden && node.getClientRects().length > 0,
  );
}

function wireOnce(el: SheetElements): void {
  if (state.wired || !el.root || !el.dialog) return;
  state.wired = true;

  el.close?.addEventListener("click", () => closeSheet(el));
  el.backdrop?.addEventListener("click", () => closeSheet(el));
  el.dialog.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      closeSheet(el);
      return;
    }
    if (event.key !== "Tab") return;
    const items = focusableItems(el.dialog!);
    if (items.length === 0) return;
    const first = items[0]!;
    const last = items[items.length - 1]!;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });

  el.copy?.addEventListener("click", () => {
    void copyLink(el);
  });
  el.download?.addEventListener("click", () => {
    void downloadImage(el);
  });
  el.native?.addEventListener("click", () => {
    void nativeShare(el);
  });
  // wa.me / t.me links can only carry text, so the branded buttons route the
  // rendered PNG through the Web Share API when the browser supports files,
  // and fall back to the link-only intent when it does not.
  el.whatsapp?.addEventListener("click", (event) => {
    event.preventDefault();
    void shareViaApp(el, "whatsapp");
  });
  el.telegram?.addEventListener("click", (event) => {
    event.preventDefault();
    void shareViaApp(el, "telegram");
  });

  if (typeof navigator.share === "function" && el.native) {
    el.native.hidden = false;
  }
}

function track(channel: "native" | "whatsapp" | "telegram" | "copy" | "download"): void {
  const mockId = state.current?.mockId;
  if (!mockId) return;
  // Attempt-context events deliberately carry the mock id only; the share API
  // rejects question-level events from a live attempt.
  recordShareEvent({ mockId, context: "attempt", channel });
}

function setStatus(el: SheetElements, message: string): void {
  if (el.status) el.status.textContent = message;
}

function showError(el: SheetElements, message: string): void {
  if (!el.error) return;
  el.error.textContent = message;
  el.error.hidden = false;
}

function clearError(el: SheetElements): void {
  if (!el.error) return;
  el.error.textContent = "";
  el.error.hidden = true;
}

function updateLinks(el: SheetElements): void {
  const current = state.current;
  if (!current) return;
  const language = normalizeShareLanguage(current.language);
  if (el.whatsapp) {
    el.whatsapp.href = whatsappShareUrl(shareMessage(language, current.shareUrl));
  }
  if (el.telegram) {
    el.telegram.href = telegramShareUrl(current.shareUrl, sharePrompt(language));
  }
}

function revokePreview(): void {
  if (state.previewUrl) URL.revokeObjectURL(state.previewUrl);
  state.previewUrl = "";
}

async function generate(el: SheetElements): Promise<void> {
  const current = state.current;
  if (!current || !el.card) return;
  const language = normalizeShareLanguage(current.language);
  const key = `${current.question.id}:${language}`;
  const generationStatusRevision = state.statusRevision;
  // Narrow once: TS loses the el.card null-narrowing inside the closure below.
  const card = el.card;
  if (!card) return;

  if (state.blob && state.cacheKey === key) return;
  if (state.failedKey === key) return;
  // A Share… tap while the render is still in flight must wait for the
  // in-flight image instead of silently falling back to a link-only share.
  if (state.generating && state.generation) {
    await state.generation;
    if ((state.blob && state.cacheKey === key) || state.failedKey === key) return;
    if (state.generating) return; // a different key took over; its caller awaits it
  }

  state.generating = true;
  state.generation = (async () => {
    clearError(el);
    setStatus(el, "Preparing image…");
    if (el.previewLoading) el.previewLoading.hidden = false;
    if (el.preview) el.preview.hidden = true;

    try {
      buildCard(el, current);
      const result = await renderShareCardPng(card, { language, includeAnswer: false });
      revokePreview();
      state.previewUrl = URL.createObjectURL(result.blob);
      state.blob = result.blob;
      state.cacheKey = key;
      state.failedKey = "";
      if (el.preview && state.previewUrl) {
        el.preview.src = state.previewUrl;
        el.preview.hidden = false;
      }
      if (el.previewLoading) el.previewLoading.hidden = true;
      if (state.statusRevision === generationStatusRevision) {
        setStatus(el, "Image ready. Share it or download the PNG.");
      }
    } catch {
      state.blob = null;
      state.cacheKey = "";
      state.failedKey = key;
      revokePreview();
      if (el.preview) el.preview.hidden = true;
      if (el.previewLoading) el.previewLoading.hidden = true;
      showError(
        el,
        "Could not create the image. You can still share the link with WhatsApp, Telegram or Copy link.",
      );
      if (state.statusRevision === generationStatusRevision) {
        setStatus(el, "Image unavailable.");
      }
    } finally {
      state.generating = false;
      state.generation = null;
    }
  })();
  await state.generation;
}

/**
 * Sends the rendered PNG through the Web Share API for the branded app
 * buttons. URL intents (wa.me / t.me) cannot carry files, so on mobile the
 * system share chooser opens pre-loaded with the image + caption and the user
 * picks the app; browsers without file support fall back to the link-only
 * intent that was already set on the anchor.
 */
async function shareViaApp(el: SheetElements, channel: "whatsapp" | "telegram"): Promise<void> {
  const current = state.current;
  if (!current) return;
  state.statusRevision += 1;
  if (!state.blob) {
    setStatus(el, "Preparing image…");
    await generate(el);
  }
  const language = normalizeShareLanguage(current.language);
  const text = shareMessage(language, current.shareUrl);
  const title = sharePrompt(language);
  if (state.blob && typeof navigator.share === "function" && typeof File === "function") {
    const file = new File(
      [state.blob],
      attemptShareFileName(current.publicId, current.mockSlug, current.question.number),
      { type: "image/png" },
    );
    if (
      typeof navigator.canShare === "function" &&
      navigator.canShare({ files: [file] })
    ) {
      try {
        await navigator.share({ files: [file], text, title });
        setStatus(el, "Shared.");
        track(channel);
      } catch (error) {
        if ((error as DOMException | undefined)?.name === "AbortError") return;
        setStatus(el, "Could not open the share dialog. Opening the link instead.");
      }
      return;
    }
  }
  // File sharing unavailable: open the link-only intent that updateLinks set.
  const anchor = channel === "whatsapp" ? el.whatsapp : el.telegram;
  const href = anchor?.getAttribute("href");
  if (href && href !== "#") {
    window.open(href, "_blank", "noopener,noreferrer");
  }
  track(channel);
}

async function copyLink(el: SheetElements): Promise<void> {
  const url = state.current?.shareUrl;
  if (!url) return;
  state.statusRevision += 1;
  try {
    await navigator.clipboard.writeText(url);
  } catch {
    const input = document.createElement("input");
    input.value = url;
    document.body.appendChild(input);
    input.select();
    (document as unknown as { execCommand(commandId: string): boolean }).execCommand("copy");
    input.remove();
  }
  setStatus(el, "Link copied.");
  track("copy");
}

async function downloadImage(el: SheetElements): Promise<void> {
  const current = state.current;
  if (!current) return;
  state.statusRevision += 1;
  if (!state.blob) await generate(el);
  if (!state.blob || !state.previewUrl) return;
  const link = document.createElement("a");
  link.href = state.previewUrl;
  link.download = attemptShareFileName(
    current.publicId,
    current.mockSlug,
    current.question.number,
  );
  document.body.appendChild(link);
  link.click();
  link.remove();
  setStatus(el, "Image download started.");
  track("download");
}

async function nativeShare(el: SheetElements): Promise<void> {
  const current = state.current;
  if (!current) return;
  if (typeof navigator.share !== "function") {
    setStatus(el, "Native sharing is not available in this browser.");
    return;
  }
  // Sharing without the image would send the recipient a bare link, so wait
  // for the render the same way Download does.
  if (!state.blob) {
    setStatus(el, "Preparing image…");
    await generate(el);
  }
  const language = normalizeShareLanguage(current.language);
  const text = shareMessage(language, current.shareUrl);
  const title = sharePrompt(language);
  try {
    const file =
      state.blob && typeof File === "function"
        ? new File([state.blob], attemptShareFileName(current.publicId, current.mockSlug, current.question.number), {
            type: "image/png",
          })
        : null;
    const canShareFile =
      file !== null &&
      typeof navigator.canShare === "function" &&
      navigator.canShare({ files: [file] });
    if (file && canShareFile) {
      await navigator.share({ files: [file], text, title });
    } else {
      await navigator.share({ text, title });
    }
    setStatus(el, "Shared.");
    track("native");
  } catch (error) {
    if ((error as DOMException | undefined)?.name === "AbortError") return;
    setStatus(el, "Could not open the share dialog. Try WhatsApp, Telegram or Copy link.");
  }
}

function closeSheet(el: SheetElements): void {
  if (!state.open || !el.dialog) return;
  state.open = false;
  el.dialog.classList.add("hidden");
  el.dialog.setAttribute("aria-hidden", "true");
  document.body.style.overflow = state.bodyOverflow;
  state.lastFocus?.focus();
}

/**
 * Renders (or reuses) the image for the given request without opening the
 * sheet. The attempt player calls this from an idle callback after every
 * question render, so by the time the candidate taps Share the blob already
 * exists and the sheet opens instantly — for every subject, since the card is
 * a straight screenshot of the same DOM (KaTeX math, figures, tables, Hindi).
 */
export async function prerenderAttemptQuestionShare(request: AttemptShareRequest): Promise<void> {
  const el = elements();
  if (!el.root || !el.card) return; // sharing disabled → no sheet in the DOM
  wireOnce(el);
  state.current = request;
  state.failedKey = "";
  await generate(el);
}

/** Opens (and lazily wires) the sheet for the given question. */
export async function openAttemptQuestionShare(request: AttemptShareRequest): Promise<void> {
  const el = elements();
  if (!el.root || !el.dialog || !el.card) return;
  wireOnce(el);

  // Cache membership is decided by the cache key (question + language), never
  // by state.current alone: a background prerender may already have advanced
  // state.current to this question while the rendered blob still belongs to
  // the previous one. Showing that stale blob here is exactly the "I am on
  // question 7 but the image shows question 1" bug.
  const key = `${request.question.id}:${normalizeShareLanguage(request.language)}`;
  const cached = Boolean(state.blob && state.cacheKey === key && state.previewUrl);
  state.current = request;
  if (state.failedKey === key) state.failedKey = ""; // opening the sheet retries a failed render
  if (cached && el.preview) {
    el.preview.src = state.previewUrl;
    el.preview.hidden = false;
    if (el.previewLoading) el.previewLoading.hidden = true;
  } else {
    revokePreview();
    if (el.preview) el.preview.hidden = true;
    if (el.previewLoading) el.previewLoading.hidden = false;
  }
  updateLinks(el);

  if (!state.open) {
    state.open = true;
    state.lastFocus = document.activeElement as HTMLElement | null;
    state.bodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    el.dialog.classList.remove("hidden");
    el.dialog.setAttribute("aria-hidden", "false");
    clearError(el);
  }
  el.close?.focus();
  if (cached) {
    setStatus(el, "Image ready. Share it or download the PNG.");
  }
  await generate(el);
}
