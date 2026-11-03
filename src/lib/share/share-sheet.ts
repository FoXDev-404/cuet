import { renderShareCardPng } from "./share-card";
import { recordShareEvent } from "./record-share-event";
import type { ShareChannel, ShareContext } from "./events";
import {
  normalizeShareLanguage,
  shareFileName,
  shareMessage,
  sharePrompt,
  telegramShareUrl,
  whatsappShareUrl,
  type ShareLanguage,
} from "./share-message";

/**
 * Accessible share sheet controller. The trigger opens a modal bottom sheet /
 * popover; the image renderer is imported only when the sheet first opens. The
 * public page keeps its plain "Copy link" control as a no-JavaScript fallback.
 */

type SheetElements = {
  trigger: HTMLButtonElement | null;
  dialog: HTMLElement | null;
  backdrop: HTMLElement | null;
  close: HTMLButtonElement | null;
  preview: HTMLImageElement | null;
  previewLoading: HTMLElement | null;
  native: HTMLButtonElement | null;
  whatsapp: HTMLAnchorElement | null;
  telegram: HTMLAnchorElement | null;
  copy: HTMLButtonElement | null;
  download: HTMLButtonElement | null;
  answerRow: HTMLElement | null;
  answerToggle: HTMLInputElement | null;
  error: HTMLElement | null;
  status: HTMLElement | null;
  card: HTMLElement | null;
};

function elements(root: HTMLElement): SheetElements {
  return {
    trigger: root.querySelector<HTMLButtonElement>("[data-share-trigger]"),
    dialog: root.querySelector<HTMLElement>("[data-share-dialog]"),
    backdrop: root.querySelector<HTMLElement>("[data-share-backdrop]"),
    close: root.querySelector<HTMLButtonElement>("[data-share-close]"),
    preview: root.querySelector<HTMLImageElement>("[data-share-preview]"),
    previewLoading: root.querySelector<HTMLElement>("[data-share-preview-loading]"),
    native: root.querySelector<HTMLButtonElement>("[data-share-native]"),
    whatsapp: root.querySelector<HTMLAnchorElement>("[data-share-whatsapp]"),
    telegram: root.querySelector<HTMLAnchorElement>("[data-share-telegram]"),
    copy: root.querySelector<HTMLButtonElement>("[data-share-copy]"),
    download: root.querySelector<HTMLButtonElement>("[data-share-download]"),
    answerRow: root.querySelector<HTMLElement>("[data-share-answer-row]"),
    answerToggle: root.querySelector<HTMLInputElement>("[data-share-answer-toggle]"),
    error: root.querySelector<HTMLElement>("[data-share-error]"),
    status: root.querySelector<HTMLElement>("[data-share-status]"),
    card: root.querySelector<HTMLElement>("[data-share-card]"),
  };
}

function focusableItems(dialog: HTMLElement): HTMLElement[] {
  return [
    ...dialog.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ),
  ].filter((node) => !node.hidden && node.getClientRects().length > 0);
}

function initSheet(root: HTMLElement): void {
  if (root.dataset.shareReady === "true") return;
  root.dataset.shareReady = "true";

  const el = elements(root);
  if (!el.dialog || !el.card || !el.trigger) return;

  const shareUrl = root.dataset.shareUrl ?? "";
  const publicId = root.dataset.sharePublicId ?? "";
  const canReveal = root.dataset.shareCanReveal === "true";
  const context = (root.dataset.shareContext as ShareContext | undefined) ?? "public_page";
  const mockIdRaw = root.dataset.shareMockId ?? "";
  const mockId = /^\d+$/.test(mockIdRaw) ? Number(mockIdRaw) : null;

  function track(channel: ShareChannel): void {
    recordShareEvent({ publicId, mockId, context, channel });
  }

  let language: ShareLanguage = normalizeShareLanguage(
    root.dataset.shareLanguage,
  );
  let includeAnswer = false;
  let isOpen = false;
  let lastFocus: HTMLElement | null = null;
  let bodyOverflow = "";
  let blob: Blob | null = null;
  let previewUrl = "";
  let cacheKey = "";
  let failedKey = "";
  let queued = false;
  let generating = false;

  function currentKey(): string {
    return `${language}:${includeAnswer ? "answer" : "plain"}`;
  }

  function setState(state: "idle" | "loading" | "ready" | "error"): void {
    root.dataset.shareState = state;
  }

  function clearError(): void {
    if (!el.error) return;
    el.error.textContent = "";
    el.error.hidden = true;
  }

  function showError(message: string): void {
    if (!el.error) return;
    el.error.textContent = message;
    el.error.hidden = false;
  }

  function setStatus(message: string): void {
    if (el.status) el.status.textContent = message;
  }

  function revokePreview(): void {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = "";
  }

  function showPreview(): void {
    if (!el.preview || !previewUrl) return;
    el.preview.src = previewUrl;
    el.preview.hidden = false;
    if (el.previewLoading) el.previewLoading.hidden = true;
  }

  function updateLinks(): void {
    if (!shareUrl) return;
    if (el.whatsapp) {
      el.whatsapp.href = whatsappShareUrl(shareMessage(language, shareUrl));
    }
    if (el.telegram) {
      el.telegram.href = telegramShareUrl(shareUrl, sharePrompt(language));
    }
  }

  async function generate(): Promise<void> {
    const key = currentKey();
    if (blob && cacheKey === key) {
      showPreview();
      setState("ready");
      return;
    }
    if (generating) {
      queued = true;
      return;
    }
    if (failedKey === key) return;

    generating = true;
    setState("loading");
    clearError();
    setStatus("Preparing image…");
    if (el.previewLoading) el.previewLoading.hidden = false;
    if (el.preview) el.preview.hidden = true;

    try {
      const result = await renderShareCardPng(el.card!, {
        language,
        includeAnswer,
      });
      revokePreview();
      previewUrl = URL.createObjectURL(result.blob);
      blob = result.blob;
      cacheKey = key;
      failedKey = "";
      showPreview();
      setState("ready");
      setStatus("Image ready. Share it or download the PNG.");
    } catch {
      blob = null;
      cacheKey = "";
      failedKey = key;
      revokePreview();
      if (el.preview) el.preview.hidden = true;
      if (el.previewLoading) el.previewLoading.hidden = true;
      setState("error");
      showError(
        "Could not create the image. You can still share the link with WhatsApp, Telegram or Copy link.",
      );
      setStatus("Image unavailable.");
    } finally {
      generating = false;
      if (queued || (cacheKey !== currentKey() && failedKey !== currentKey())) {
        queued = false;
        void generate();
      }
    }
  }

  function openSheet(): void {
    if (isOpen) return;
    isOpen = true;
    lastFocus = document.activeElement as HTMLElement | null;
    el.dialog!.classList.remove("hidden");
    el.dialog!.setAttribute("aria-hidden", "false");
    el.trigger!.setAttribute("aria-expanded", "true");
    bodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    clearError();
    updateLinks();
    el.close?.focus();
    void generate();
  }

  function closeSheet(): void {
    if (!isOpen) return;
    isOpen = false;
    el.dialog!.classList.add("hidden");
    el.dialog!.setAttribute("aria-hidden", "true");
    el.trigger!.setAttribute("aria-expanded", "false");
    document.body.style.overflow = bodyOverflow;
    lastFocus?.focus();
  }

  async function copyLink(): Promise<void> {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
    } catch {
      const input = document.createElement("input");
      input.value = shareUrl;
      document.body.appendChild(input);
      input.select();
      (document as unknown as { execCommand(commandId: string): boolean }).execCommand(
        "copy",
      );
      input.remove();
    }
    setStatus("Link copied.");
    track("copy");
  }

  async function downloadImage(): Promise<void> {
    if (!blob || cacheKey !== currentKey()) {
      await generate();
    }
    if (!blob || !previewUrl) return;
    const link = document.createElement("a");
    link.href = previewUrl;
    link.download = shareFileName(publicId);
    document.body.appendChild(link);
    link.click();
    link.remove();
    setStatus("Image download started.");
    track("download");
  }

  async function nativeShare(): Promise<void> {
    if (typeof navigator.share !== "function") {
      setStatus("Native sharing is not available in this browser.");
      return;
    }
    const text = shareMessage(language, shareUrl);
    const title = sharePrompt(language);
    try {
      const file =
        blob && publicId
          ? new File([blob], shareFileName(publicId), { type: "image/png" })
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
      setStatus("Shared.");
      track("native");
    } catch (error) {
      if ((error as DOMException | undefined)?.name === "AbortError") return;
      setStatus("Could not open the share dialog. Try WhatsApp, Telegram or Copy link.");
    }
  }

  function setLanguage(next: unknown): void {
    const normalized = normalizeShareLanguage(next);
    if (normalized === language) return;
    language = normalized;
    blob = null;
    cacheKey = "";
    failedKey = "";
    revokePreview();
    if (el.preview) el.preview.hidden = true;
    updateLinks();
    if (isOpen) void generate();
  }

  el.trigger.addEventListener("click", openSheet);
  el.close?.addEventListener("click", closeSheet);
  el.backdrop?.addEventListener("click", closeSheet);

  el.dialog.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      closeSheet();
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

  el.answerToggle?.addEventListener("change", () => {
    if (!canReveal) return;
    includeAnswer = el.answerToggle!.checked;
    blob = null;
    cacheKey = "";
    failedKey = "";
    revokePreview();
    if (el.preview) el.preview.hidden = true;
    if (isOpen) void generate();
  });

  el.copy?.addEventListener("click", () => {
    void copyLink();
  });
  el.whatsapp?.addEventListener("click", () => track("whatsapp"));
  el.telegram?.addEventListener("click", () => track("telegram"));
  el.download?.addEventListener("click", () => {
    void downloadImage();
  });
  el.native?.addEventListener("click", () => {
    void nativeShare();
  });

  document.addEventListener("share:language", (event) => {
    setLanguage((event as CustomEvent<unknown>).detail);
  });

  if (typeof navigator.share === "function" && el.native) {
    el.native.hidden = false;
  }
  if (!canReveal && el.answerRow) el.answerRow.hidden = true;
  updateLinks();
  setState("idle");
}

export function initShareSheets(scope: ParentNode = document): void {
  scope.querySelectorAll<HTMLElement>("[data-share-sheet]").forEach(initSheet);
}
