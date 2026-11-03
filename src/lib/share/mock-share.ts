import { recordShareEvent } from "./record-share-event";
import {
  shareMockMessage,
  shareMockTitle,
  telegramShareUrl,
  whatsappShareUrl,
} from "./share-message";

/**
 * Link-only share sheet for the live ranked attempt. It never renders question
 * text, options, an answer or an image; it shares the mock instructions URL.
 * Opening it only overlays the page, so the timer and autosave keep running.
 */

type MockShareElements = {
  trigger: HTMLButtonElement | null;
  dialog: HTMLElement | null;
  backdrop: HTMLElement | null;
  close: HTMLButtonElement | null;
  native: HTMLButtonElement | null;
  whatsapp: HTMLAnchorElement | null;
  telegram: HTMLAnchorElement | null;
  copy: HTMLButtonElement | null;
  error: HTMLElement | null;
  status: HTMLElement | null;
};

function elements(root: HTMLElement): MockShareElements {
  return {
    trigger: root.querySelector<HTMLButtonElement>("[data-mock-share-trigger]"),
    dialog: root.querySelector<HTMLElement>("[data-mock-share-dialog]"),
    backdrop: root.querySelector<HTMLElement>("[data-mock-share-backdrop]"),
    close: root.querySelector<HTMLButtonElement>("[data-mock-share-close]"),
    native: root.querySelector<HTMLButtonElement>("[data-mock-share-native]"),
    whatsapp: root.querySelector<HTMLAnchorElement>("[data-mock-share-whatsapp]"),
    telegram: root.querySelector<HTMLAnchorElement>("[data-mock-share-telegram]"),
    copy: root.querySelector<HTMLButtonElement>("[data-mock-share-copy]"),
    error: root.querySelector<HTMLElement>("[data-mock-share-error]"),
    status: root.querySelector<HTMLElement>("[data-mock-share-status]"),
  };
}

function focusableItems(dialog: HTMLElement): HTMLElement[] {
  return [
    ...dialog.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ),
  ].filter((node) => !node.hidden && node.getClientRects().length > 0);
}

function initMockShare(root: HTMLElement): void {
  if (root.dataset.mockShareReady === "true") return;
  root.dataset.mockShareReady = "true";

  const el = elements(root);
  if (!el.dialog || !el.trigger) return;

  const shareUrl = root.dataset.shareUrl ?? "";
  const mockIdValue = Number(root.dataset.shareMockId ?? "");
  const mockId = Number.isInteger(mockIdValue) && mockIdValue > 0 ? mockIdValue : null;

  let isOpen = false;
  let lastFocus: HTMLElement | null = null;
  let bodyOverflow = "";

  function track(channel: "native" | "whatsapp" | "telegram" | "copy"): void {
    recordShareEvent({ mockId, context: "attempt", channel });
  }

  function setStatus(message: string): void {
    if (el.status) el.status.textContent = message;
  }

  function updateLinks(): void {
    if (!shareUrl) return;
    if (el.whatsapp) {
      el.whatsapp.href = whatsappShareUrl(shareMockMessage(shareUrl));
    }
    if (el.telegram) {
      el.telegram.href = telegramShareUrl(shareUrl, shareMockTitle());
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
    if (el.error) {
      el.error.textContent = "";
      el.error.hidden = true;
    }
    updateLinks();
    el.close?.focus();
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

  async function nativeShare(): Promise<void> {
    if (typeof navigator.share !== "function") {
      setStatus("Native sharing is not available in this browser.");
      return;
    }
    try {
      await navigator.share({
        title: shareMockTitle(),
        text: shareMockMessage(shareUrl),
      });
      setStatus("Shared.");
      track("native");
    } catch (error) {
      if ((error as DOMException | undefined)?.name === "AbortError") return;
      setStatus("Could not open the share dialog. Try WhatsApp, Telegram or Copy link.");
    }
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

  el.copy?.addEventListener("click", () => {
    void copyLink();
  });
  el.whatsapp?.addEventListener("click", () => track("whatsapp"));
  el.telegram?.addEventListener("click", () => track("telegram"));
  el.native?.addEventListener("click", () => {
    void nativeShare();
  });

  if (typeof navigator.share === "function" && el.native) {
    el.native.hidden = false;
  }
  updateLinks();
}

export function initMockShareSheets(scope: ParentNode = document): void {
  scope.querySelectorAll<HTMLElement>("[data-mock-share-sheet]").forEach(initMockShare);
}
