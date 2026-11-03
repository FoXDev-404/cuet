import type { ShareChannel, ShareContext } from "./events";

/**
 * Fire-and-forget analytics for a completed share action. Failures never block
 * the share UI, and no attempt id, question id, email or IP is sent.
 */
export function recordShareEvent(event: {
  publicId?: string | null;
  mockId?: number | null;
  context: ShareContext;
  channel: ShareChannel;
}): void {
  const payload = {
    publicId: event.publicId ?? null,
    mockId: event.mockId ?? null,
    context: event.context,
    channel: event.channel,
  };
  try {
    void fetch("/api/share-events", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
      credentials: "same-origin",
      keepalive: true,
    }).catch(() => {
      // Analytics is best-effort; the user already completed the share.
    });
  } catch {
    // A blocked fetch must not break the sheet.
  }
}
