import { isValidPublicId } from "./public-id";

/**
 * Share-event validation, kept pure so the API and tests agree on the exact
 * accepted shape. Events are aggregate counters only: they carry the public
 * question id or mock id, the surface, the channel and the signed-in user id.
 * They never contain an IP address, attempt id, score or answer.
 */

export const SHARE_CONTEXTS = ["attempt", "solutions", "practice", "public_page"] as const;
export const SHARE_CHANNELS = ["native", "whatsapp", "telegram", "copy", "download"] as const;

export type ShareContext = (typeof SHARE_CONTEXTS)[number];
export type ShareChannel = (typeof SHARE_CHANNELS)[number];

export type ShareEvent = {
  publicId: string | null;
  mockId: number | null;
  context: ShareContext;
  channel: ShareChannel;
};

export type ShareEventResult =
  | { ok: true; event: ShareEvent }
  | { ok: false; error: string };

function isContext(value: unknown): value is ShareContext {
  return typeof value === "string" && (SHARE_CONTEXTS as readonly string[]).includes(value);
}

function isChannel(value: unknown): value is ShareChannel {
  return typeof value === "string" && (SHARE_CHANNELS as readonly string[]).includes(value);
}

export function normalizeShareEvent(input: unknown): ShareEventResult {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { ok: false, error: "Send a share event." };
  }
  const record = input as Record<string, unknown>;

  if (!isContext(record.context)) {
    return { ok: false, error: "Unknown share context." };
  }
  if (!isChannel(record.channel)) {
    return { ok: false, error: "Unknown share channel." };
  }

  const publicIdRaw = record.publicId;
  const hasPublicId =
    publicIdRaw !== undefined && publicIdRaw !== null && publicIdRaw !== "";
  const publicId = hasPublicId ? String(publicIdRaw) : null;
  if (publicId !== null && !isValidPublicId(publicId)) {
    return { ok: false, error: "Invalid public question id." };
  }

  const mockIdRaw = record.mockId;
  const hasMockId = mockIdRaw !== undefined && mockIdRaw !== null && mockIdRaw !== "";
  const mockId = hasMockId ? Number(mockIdRaw) : null;
  if (mockId !== null && (!Number.isInteger(mockId) || mockId <= 0)) {
    return { ok: false, error: "Invalid mock id." };
  }

  if (record.context === "attempt") {
    // The live attempt surface only ever shares the mock link; a question id
    // there would mean question content was shareable during a ranked test.
    if (publicId !== null) {
      return { ok: false, error: "Live attempts can only share the mock link." };
    }
    if (mockId === null) {
      return { ok: false, error: "A mock id is required for live attempts." };
    }
  } else if (publicId === null) {
    return { ok: false, error: "A public question id is required." };
  }

  return {
    ok: true,
    event: {
      publicId,
      mockId,
      context: record.context,
      channel: record.channel,
    },
  };
}
