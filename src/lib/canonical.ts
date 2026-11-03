/**
 * Canonical overrides must be absolute HTTP(S) URLs. Fragments are removed so
 * the tag always points at the document, not a section inside it.
 */
export function normalizeCanonicalUrl(value: string): string | null {
  try {
    const parsed = new URL(value.trim());
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    parsed.hash = "";
    return parsed.toString();
  } catch {
    return null;
  }
}
