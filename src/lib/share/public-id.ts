/**
 * Public question identifiers and slugs.
 *
 * The database id must never appear in a public URL, payload or share image.
 * A public id is ten base62 characters drawn from 60 crypto-random bits with
 * rejection sampling, so every character is uniformly distributed.
 */

export const PUBLIC_ID_LENGTH = 10;
export const PUBLIC_ID_ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

const BASE = 62n;
const PUBLIC_ID_SPACE = BASE ** BigInt(PUBLIC_ID_LENGTH);
const SIXTY_BIT_MASK = (1n << 60n) - 1n;
const PUBLIC_ID_PATTERN = /^[0-9A-Za-z]{10}$/;

/** Encode a value below 62^10 as exactly ten base62 characters. */
export function encodePublicId(value: bigint): string {
  if (value < 0n || value >= PUBLIC_ID_SPACE) {
    throw new RangeError("Public id value is outside the 10-character base62 space.");
  }
  let remaining = value;
  let output = "";
  for (let index = 0; index < PUBLIC_ID_LENGTH; index += 1) {
    output = PUBLIC_ID_ALPHABET[Number(remaining % BASE)]! + output;
    remaining /= BASE;
  }
  return output;
}

/**
 * Generate a public id with Web Crypto. The 60-bit candidate space is slightly
 * larger than 62^10, so values above the alphabet space are rejected instead
 * of reducing them modulo 62^10 (which would bias the first characters).
 */
export function generatePublicId(): string {
  const bytes = new Uint8Array(8);
  for (;;) {
    crypto.getRandomValues(bytes);
    let value = 0n;
    for (const byte of bytes) value = (value << 8n) | BigInt(byte);
    value &= SIXTY_BIT_MASK;
    if (value < PUBLIC_ID_SPACE) return encodePublicId(value);
  }
}

export function isValidPublicId(value: string): boolean {
  return PUBLIC_ID_PATTERN.test(value);
}

/** D1/SQLite unique-constraint check used by insert retry loops. */
export function isPublicIdCollision(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /UNIQUE constraint failed: question_public_ids\.public_id/i.test(message);
}

/**
 * Parse an id from the end of a `/q/...` segment. The slug is cosmetic; a
 * wrong or missing slug still resolves to the same public id and the page
 * redirects to its canonical URL.
 */
export function parsePublicId(segment: string): string | null {
  const cleaned = segment.trim();
  if (isValidPublicId(cleaned)) return cleaned;
  const match = /-([0-9A-Za-z]{10})$/.exec(cleaned);
  return match && isValidPublicId(match[1]!) ? match[1]! : null;
}

const DEVANAGARI: Record<string, string> = {
  "अ": "a", "आ": "aa", "इ": "i", "ई": "ee", "उ": "u", "ऊ": "oo", "ऋ": "ri",
  "ए": "e", "ऐ": "ai", "ओ": "o", "औ": "au", "अं": "an", "अः": "ah", "ॐ": "om",
  "क": "k", "ख": "kh", "ग": "g", "घ": "gh", "ङ": "ng",
  "च": "ch", "छ": "chh", "ज": "j", "झ": "jh", "ञ": "n",
  "ट": "t", "ठ": "th", "ड": "d", "ढ": "dh", "ण": "n",
  "त": "t", "थ": "th", "द": "d", "ध": "dh", "न": "n",
  "प": "p", "फ": "ph", "ब": "b", "भ": "bh", "म": "m",
  "य": "y", "र": "r", "ल": "l", "व": "v", "श": "sh", "ष": "sh", "स": "s", "ह": "h",
  "क़": "q", "ख़": "kh", "ग़": "g", "ज़": "z", "ड़": "r", "ढ़": "rh", "फ़": "f",
  "ा": "a", "ि": "i", "ी": "ee", "ु": "u", "ू": "oo", "ृ": "ri",
  "े": "e", "ै": "ai", "ो": "o", "ौ": "au", "ं": "n", "ः": "h",
  "्": "", "ॅ": "e", "ॉ": "o", "ँ": "n",
  "०": "0", "१": "1", "२": "2", "३": "3", "४": "4",
  "५": "5", "६": "6", "७": "7", "८": "8", "९": "9",
};

function transliterate(value: string): string {
  return [...value].map((character) => DEVANAGARI[character] ?? character).join("");
}

/**
 * Build a readable ASCII slug from the first six words of the question. The
 * public id remains the lookup key, so an imperfect transliteration only costs
 * a canonical redirect.
 */
export function slugifyQuestion(text: string): string {
  const ascii = transliterate(text)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  const words = ascii
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 6);
  return words.join("-").slice(0, 80).replace(/-+$/g, "") || "question";
}

/** Canonical public path for a shared question. Never includes questions.id. */
export function questionSharePath(publicId: string, text: string): string {
  if (!isValidPublicId(publicId)) {
    throw new Error("Cannot build a question URL from an invalid public id.");
  }
  return `/q/${slugifyQuestion(text)}-${publicId}`;
}
