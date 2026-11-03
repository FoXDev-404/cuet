import { all, first, run } from "./db";

export type SiteSettingRow = { key: string; value: string };

export async function getSetting(key: string, fallback = ""): Promise<string> {
  try {
    const row = await first<SiteSettingRow>(
      "SELECT key, value FROM site_settings WHERE key = ?",
      key,
    );
    return row?.value ?? fallback;
  } catch {
    return fallback;
  }
}

export async function getSettings(keys: string[]): Promise<Record<string, string>> {
  if (keys.length === 0) return {};
  try {
    const placeholders = keys.map(() => "?").join(",");
    const rows = await all<SiteSettingRow>(
      `SELECT key, value FROM site_settings WHERE key IN (${placeholders})`,
      ...keys,
    );
    return Object.fromEntries(rows.map((row) => [row.key, row.value]));
  } catch {
    return {};
  }
}

export async function setSetting(key: string, value: string): Promise<void> {
  await run(
    `INSERT INTO site_settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    key,
    value,
  );
}

export function isEnabled(value: string | undefined, fallback = true): boolean {
  if (value === undefined) return fallback;
  return value === "true" || value === "1";
}

export type AnnouncementRow = {
  id: number;
  message: string;
  link: string | null;
  is_active: number;
  starts_at: string | null;
  ends_at: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export async function activeAnnouncements(limit = 3): Promise<AnnouncementRow[]> {
  try {
    return await all<AnnouncementRow>(
      `SELECT id, message, link, is_active, starts_at, ends_at, created_at, updated_at
       FROM announcements
       WHERE is_active = 1
         AND (starts_at IS NULL OR datetime(starts_at) <= datetime('now'))
         AND (ends_at IS NULL OR datetime(ends_at) >= datetime('now'))
       ORDER BY id DESC LIMIT ?`,
      limit,
    );
  } catch {
    return [];
  }
}
