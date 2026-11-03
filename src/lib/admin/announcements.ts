import { z } from "zod";
import { all, first, run } from "../db";

function parseSchedule(value: string): string | null {
  const raw = value.trim();
  if (!raw) return null;
  // <input type="datetime-local"> values have no timezone. Admins enter them in
  // Asia/Kolkata (UTC+05:30); store the equivalent UTC instant.
  const local = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(raw)
    ? new Date(`${raw}:00+05:30`)
    : new Date(raw);
  if (Number.isNaN(local.getTime())) throw new Error("Enter a valid schedule date and time.");
  return local.toISOString();
}

const scheduleField = z
  .string()
  .trim()
  .max(40)
  .optional()
  .default("")
  .transform((value, ctx) => {
    try {
      return parseSchedule(value);
    } catch (error) {
      ctx.addIssue({
        code: "custom",
        message: error instanceof Error ? error.message : "Enter a valid schedule date and time.",
      });
      return z.NEVER;
    }
  });

export const announcementSchema = z
  .object({
    message: z.string().trim().min(3).max(500),
    link: z.string().trim().max(1000).optional().default(""),
    is_active: z
      .union([z.boolean(), z.string(), z.number()])
      .optional()
      .default(true)
      .transform((value) => (value === false || value === "false" || value === "0" || value === 0 ? 0 : 1)),
    starts_at: scheduleField,
    ends_at: scheduleField,
  })
  .superRefine((value, ctx) => {
    if (value.link) {
      const valid =
        value.link.startsWith("/") ||
        (() => {
          try {
            return ["http:", "https:"].includes(new URL(value.link).protocol);
          } catch {
            return false;
          }
        })();
      if (!valid) {
        ctx.addIssue({
          code: "custom",
          path: ["link"],
          message: "Link must be a relative path or an http(s) URL.",
        });
      }
    }
    if (value.starts_at && value.ends_at && value.ends_at <= value.starts_at) {
      ctx.addIssue({
        code: "custom",
        path: ["ends_at"],
        message: "The end time must be after the start time.",
      });
    }
  });

export type AnnouncementPayload = z.infer<typeof announcementSchema>;

export type AdminAnnouncementRow = {
  id: number;
  message: string;
  link: string | null;
  is_active: number;
  starts_at: string | null;
  ends_at: string | null;
  created_at: string | null;
  updated_at: string | null;
  created_by: number | null;
  admin_email: string | null;
};

export async function listAnnouncements(): Promise<AdminAnnouncementRow[]> {
  return all<AdminAnnouncementRow>(
    `SELECT a.id, a.message, a.link, a.is_active, a.starts_at, a.ends_at,
            a.created_at, a.updated_at, a.created_by, ad.email AS admin_email
     FROM announcements a
     LEFT JOIN admins ad ON ad.id = a.created_by
     WHERE a.deleted_at IS NULL
     ORDER BY a.id DESC`,
  );
}

export async function findAnnouncement(id: number): Promise<AdminAnnouncementRow | null> {
  return first<AdminAnnouncementRow>(
    `SELECT a.id, a.message, a.link, a.is_active, a.starts_at, a.ends_at,
            a.created_at, a.updated_at, a.created_by, ad.email AS admin_email
     FROM announcements a
     LEFT JOIN admins ad ON ad.id = a.created_by
     WHERE a.id = ? AND a.deleted_at IS NULL`,
    id,
  );
}

export async function saveAnnouncement(
  input: AnnouncementPayload,
  adminId: number,
  id?: number,
): Promise<number> {
  const now = new Date().toISOString();
  if (id) {
    const existing = await findAnnouncement(id);
    if (!existing) throw new Error("Announcement not found.");
    await run(
      `UPDATE announcements
       SET message = ?, link = ?, is_active = ?, starts_at = ?, ends_at = ?, updated_at = ?
       WHERE id = ? AND deleted_at IS NULL`,
      input.message,
      input.link || null,
      input.is_active,
      input.starts_at,
      input.ends_at,
      now,
      id,
    );
    return id;
  }

  const result = await run(
    `INSERT INTO announcements
      (message, link, is_active, starts_at, ends_at, created_at, updated_at, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    input.message,
    input.link || null,
    input.is_active,
    input.starts_at,
    input.ends_at,
    now,
    now,
    adminId,
  );
  return Number(result.meta.last_row_id);
}

export async function deleteAnnouncement(id: number): Promise<void> {
  await run(
    `UPDATE announcements
     SET is_active = 0, deleted_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
         updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
     WHERE id = ? AND deleted_at IS NULL`,
    id,
  );
}

/** Convert a stored UTC ISO timestamp into a datetime-local value in IST. */
export function toIstInput(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const ist = new Date(date.getTime() + 5.5 * 60 * 60 * 1000);
  return ist.toISOString().slice(0, 16);
}
