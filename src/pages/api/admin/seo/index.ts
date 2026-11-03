import type { APIRoute } from "astro";
import { requirePermission } from "../../../../lib/auth/guard";
import { audit } from "../../../../lib/audit";
import { run } from "../../../../lib/db";
import { apiError, forbiddenOrigin, isSameOrigin, json } from "../../../../lib/http";
import { normalizeCanonicalUrl, parseFaq } from "../../../../lib/seo";

export const PUT: APIRoute = async (context) => {
  if (!isSameOrigin(context.request)) return forbiddenOrigin();
  const guard = requirePermission(context, "seo.write");
  if (guard.response) return guard.response;

  let body: Record<string, unknown>;
  try {
    body = (await context.request.json()) as Record<string, unknown>;
  } catch {
    return apiError("Invalid request body.");
  }

  const path = String(body.path ?? "").trim();
  if (!path.startsWith("/") || path.length > 200 || /[\s<>"']/.test(path)) {
    return apiError("Enter a valid site path starting with /.");
  }

  const title = String(body.title ?? "").trim();
  const description = String(body.description ?? "").trim();
  const intro = String(body.intro_html ?? "").trim();
  if (title.length > 120) return apiError("Title must be 120 characters or fewer.");
  if (description.length > 300) return apiError("Description must be 300 characters or fewer.");
  if (intro.length > 20_000) return apiError("Intro text is too long.");

  const rawCanonical = String(body.canonical_url ?? "").trim();
  if (rawCanonical.length > 500) return apiError("Canonical URL must be 500 characters or fewer.");
  const canonicalUrl = rawCanonical ? normalizeCanonicalUrl(rawCanonical) : null;
  if (rawCanonical && !canonicalUrl) {
    return apiError("Canonical URL must be an absolute http(s) URL.");
  }

  let faqJson: string | null = null;
  const rawFaq = body.faq_json;
  if (rawFaq !== undefined && rawFaq !== null && String(rawFaq).trim() !== "") {
    let parsed: unknown;
    try {
      parsed = typeof rawFaq === "string" ? JSON.parse(rawFaq) : rawFaq;
    } catch {
      return apiError("FAQ must be valid JSON.");
    }
    if (!Array.isArray(parsed)) return apiError("FAQ must be a JSON array.");
    if (parsed.length > 12) return apiError("Add at most 12 FAQ entries.");
    const cleaned = parsed
      .map((item) => {
        const record = (item ?? {}) as Record<string, unknown>;
        return {
          question: String(record.question ?? "").trim(),
          answer: String(record.answer ?? "").trim(),
        };
      })
      .filter((item) => item.question || item.answer);
    if (cleaned.some((item) => item.question.length < 3 || item.answer.length < 3)) {
      return apiError("Every FAQ needs a question and answer of at least 3 characters.");
    }
    if (cleaned.some((item) => item.question.length > 200 || item.answer.length > 1200)) {
      return apiError("Keep each FAQ question under 200 and answer under 1200 characters.");
    }
    faqJson = cleaned.length > 0 ? JSON.stringify(cleaned) : null;
    if (faqJson && parseFaq(faqJson).length !== cleaned.length) {
      return apiError("FAQ could not be validated.");
    }
  }

  const noindex = body.noindex === true || body.noindex === 1 || body.noindex === "1" ? 1 : 0;

  try {
    await run(
      `INSERT INTO page_seo (path, title, description, intro_html, faq_json, canonical_url, noindex, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
       ON CONFLICT(path) DO UPDATE SET
         title = excluded.title,
         description = excluded.description,
         intro_html = excluded.intro_html,
         faq_json = excluded.faq_json,
         canonical_url = excluded.canonical_url,
         noindex = excluded.noindex,
         updated_at = excluded.updated_at`,
      path,
      title || null,
      description || null,
      intro || null,
      faqJson,
      canonicalUrl,
      noindex,
    );
  } catch (error) {
    console.error("seo save failed", error);
    return apiError("Could not save the SEO record.", 500);
  }

  await audit({
    adminId: guard.admin.id,
    action: "seo.update",
    entityType: "page_seo",
    entityId: null,
    diff: { path, title, description, canonicalUrl, noindex },
  });

  return json({ ok: true, path, canonicalUrl, noindex });
};
