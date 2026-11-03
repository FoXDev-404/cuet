import { all } from "../db";
import { can, type AdminRole } from "../auth/admin";

export type SearchHit = {
  group: string;
  id: string | number | null;
  title: string;
  detail: string;
  href: string;
};

export type SearchGroup = {
  key: string;
  label: string;
  hits: SearchHit[];
};

type SearchRow = Record<string, string | number | null>;

function clean(value: unknown, limit = 140): string {
  return String(value ?? "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, limit);
}

export async function adminSearch(role: AdminRole, rawQuery: string): Promise<SearchGroup[]> {
  const query = rawQuery.trim().slice(0, 100);
  if (query.length < 2) return [];
  const like = `%${query}%`;
  const digits = /^\d+$/.test(query) ? Number(query) : 0;
  const groups: Array<SearchGroup | null> = [];

  if (can(role, "questions.write")) {
    const rows = await all<SearchRow>(
      `SELECT id, text, status FROM questions
       WHERE deleted_at IS NULL AND text LIKE ?
       ORDER BY id DESC LIMIT 8`,
      like,
    );
    groups.push({
      key: "questions",
      label: "Questions",
      hits: rows.map((row) => ({
        group: "questions",
        id: row.id,
        title: clean(row.text) || `Question #${row.id}`,
        detail: `#${row.id} · ${row.status}`,
        href: `/admin/questions/${row.id}`,
      })),
    });
  }

  if (can(role, "mocks.write")) {
    const rows = await all<SearchRow>(
      `SELECT id, title, slug, status FROM mock_tests
       WHERE deleted_at IS NULL AND (title LIKE ? OR slug LIKE ? OR (? > 0 AND id = ?))
       ORDER BY id DESC LIMIT 8`,
      like,
      like,
      digits,
      digits,
    );
    groups.push({
      key: "mocks",
      label: "Mock tests",
      hits: rows.map((row) => ({
        group: "mocks",
        id: row.id,
        title: clean(row.title),
        detail: `${row.status} · /${row.slug}`,
        href: `/admin/mocks/${row.id}`,
      })),
    });
  }

  if (can(role, "users.view") || can(role, "moderation.write")) {
    const rows = await all<SearchRow>(
      `SELECT id, username, email, banned_at, deleted_at FROM users
       WHERE username LIKE ? OR email LIKE ? OR (? > 0 AND id = ?)
       ORDER BY id DESC LIMIT 8`,
      like,
      like,
      digits,
      digits,
    );
    groups.push({
      key: "users",
      label: "Users",
      hits: rows.map((row) => ({
        group: "users",
        id: row.id,
        title: clean(row.username),
        detail: `${clean(row.email)}${row.banned_at ? " · banned" : row.deleted_at ? " · deleted" : ""}`,
        href: `/admin/users?q=${encodeURIComponent(String(row.email ?? ""))}`,
      })),
    });
  }

  if (can(role, "attempts.view")) {
    const rows = await all<SearchRow>(
      `SELECT a.id, a.status, a.score, m.title AS mock_title, u.username
       FROM attempts a
       JOIN mock_tests m ON m.id = a.mock_id
       LEFT JOIN users u ON u.id = a.user_id
       WHERE (? > 0 AND a.id = ?) OR u.email LIKE ? OR u.username LIKE ? OR m.title LIKE ?
       ORDER BY a.id DESC LIMIT 8`,
      digits,
      digits,
      like,
      like,
      like,
    );
    groups.push({
      key: "attempts",
      label: "Attempts",
      hits: rows.map((row) => ({
        group: "attempts",
        id: row.id,
        title: `Attempt #${row.id} · ${clean(row.mock_title, 80)}`,
        detail: `${row.username ?? "Guest"} · ${row.status} · ${row.score ?? "—"}`,
        href: `/admin/attempts/${row.id}`,
      })),
    });
  }

  if (can(role, "taxonomy.write")) {
    const rows = await all<SearchRow>(
      `SELECT p.id, p.body, s.name AS subject_name FROM passages p
       JOIN subjects s ON s.id = p.subject_id
       WHERE p.deleted_at IS NULL AND (p.body LIKE ? OR p.body_hi LIKE ?)
       ORDER BY p.id DESC LIMIT 8`,
      like,
      like,
    );
    groups.push({
      key: "passages",
      label: "Passages",
      hits: rows.map((row) => ({
        group: "passages",
        id: row.id,
        title: clean(row.body) || `Passage #${row.id}`,
        detail: `#${row.id} · ${clean(row.subject_name, 60)}`,
        href: `/admin/passages?id=${row.id}`,
      })),
    });
  }

  if (can(role, "seo.write")) {
    const rows = await all<SearchRow>(
      `SELECT id, title, slug, status FROM blog_posts
       WHERE deleted_at IS NULL AND (title LIKE ? OR slug LIKE ?)
       ORDER BY id DESC LIMIT 8`,
      like,
      like,
    );
    groups.push({
      key: "guides",
      label: "Guides",
      hits: rows.map((row) => ({
        group: "guides",
        id: row.id,
        title: clean(row.title),
        detail: `${row.status} · /${row.slug}`,
        href: `/admin/blog?id=${row.id}`,
      })),
    });
  }

  if (can(role, "announcements.write")) {
    const rows = await all<SearchRow>(
      `SELECT id, message, is_active FROM announcements
       WHERE deleted_at IS NULL AND message LIKE ?
       ORDER BY id DESC LIMIT 8`,
      like,
    );
    groups.push({
      key: "announcements",
      label: "Announcements",
      hits: rows.map((row) => ({
        group: "announcements",
        id: row.id,
        title: clean(row.message),
        detail: `#${row.id} · ${row.is_active ? "active" : "inactive"}`,
        href: `/admin/announcements?id=${row.id}`,
      })),
    });
  }

  return groups.filter((group): group is SearchGroup => Boolean(group && group.hits.length > 0));
}
