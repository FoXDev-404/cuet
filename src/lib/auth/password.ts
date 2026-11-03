/**
 * Cloudflare Workers' WebCrypto rejects PBKDF2 requests above 100,000
 * iterations ("iteration counts above 100000 are not supported"), so 100k is
 * the platform ceiling. Keep this in sync with the format parser below; newer
 * hashes must use this exact iteration count.
 */
const ITERATIONS = 100_000;
const KEY_BYTES = 32;
const SALT_BYTES = 16;

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function fromBase64(value: string): Uint8Array<ArrayBuffer> {
  const binary = atob(value);
  const buffer = new ArrayBuffer(binary.length);
  const bytes = new Uint8Array(buffer);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

export async function hashPassword(password: string): Promise<string> {
  if (password.length < 8) throw new Error("Password must be at least 8 characters.");
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: ITERATIONS, hash: "SHA-256" },
    key,
    KEY_BYTES * 8,
  );
  return `pbkdf2$${ITERATIONS}$${toBase64(salt)}$${toBase64(new Uint8Array(bits))}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  try {
    const parts = stored.split("$");
    if (parts.length !== 4 || parts[0] !== "pbkdf2") return false;
    const iterations = Number(parts[1]);
    if (!Number.isInteger(iterations) || iterations < 100_000) return false;

    const salt = fromBase64(parts[2]);
    const expected = fromBase64(parts[3]);
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(password),
      "PBKDF2",
      false,
      ["deriveBits"],
    );
    const bits = await crypto.subtle.deriveBits(
      { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
      key,
      expected.length * 8,
    );
    const actual = new Uint8Array(bits);
    if (actual.length !== expected.length) return false;

    let mismatch = 0;
    for (let index = 0; index < actual.length; index += 1) {
      mismatch |= actual[index] ^ expected[index];
    }
    return mismatch === 0;
  } catch {
    // Malformed hashes, invalid base64, or runtimes that cap PBKDF2 iterations
    // (Cloudflare Workers: 100k) must fail closed rather than crash a login.
    return false;
  }
}
