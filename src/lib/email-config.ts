/**
 * Transactional email configuration and delivery.
 *
 * Kept separate from `email.ts` (which reads the Worker binding) so the
 * provider selection, address parsing and HTTP payloads are unit-testable.
 * No function logs a reset token or an API key.
 */

export type EmailEnv = {
  EMAIL_PROVIDER?: string;
  EMAIL_FROM?: string;
  RESEND_API_KEY?: string;
  BREVO_API_KEY?: string;
};

export type EmailProvider = "resend" | "brevo";

export type EmailConfig = {
  provider: EmailProvider;
  apiKey: string;
  fromName: string;
  fromEmail: string;
};

export type EmailMessage = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

export type EmailResult = { ok: true } | { ok: false; error: string };

const EMAIL_ADDRESS = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;

function clean(value: string | undefined): string {
  return (value ?? "").trim();
}

/** Parse `Name <address>` or a bare address, rejecting header injection. */
export function parseEmailFrom(raw: string): { name: string; email: string } | null {
  const value = raw.trim();
  if (!value || /[\r\n]/.test(value)) return null;

  const angle = value.match(/^(.*?)\s*<([^<>]+)>$/);
  const name = (angle?.[1] ?? "").trim().replace(/^["']|["']$/g, "").trim();
  const email = (angle?.[2] ?? value).trim();

  if (!EMAIL_ADDRESS.test(email)) return null;
  return { name: name || "CUET Free Mock Test", email };
}

/**
 * Resolve a provider from EMAIL_PROVIDER plus the matching key. Returns null
 * for an unknown provider, a missing key or an unusable EMAIL_FROM.
 */
export function emailConfig(envLike: EmailEnv): EmailConfig | null {
  const provider = clean(envLike.EMAIL_PROVIDER).toLowerCase();
  const from = parseEmailFrom(clean(envLike.EMAIL_FROM));
  if (!from) return null;

  if (provider === "resend") {
    const apiKey = clean(envLike.RESEND_API_KEY);
    if (!apiKey) return null;
    return { provider, apiKey, fromName: from.name, fromEmail: from.email };
  }

  if (provider === "brevo") {
    const apiKey = clean(envLike.BREVO_API_KEY);
    if (!apiKey) return null;
    return { provider, apiKey, fromName: from.name, fromEmail: from.email };
  }

  return null;
}

/** DEV_SHOW_RESET_LINK is honoured only outside production builds. */
export function devResetLinkAllowed(production: boolean, flag: string | undefined): boolean {
  return !production && clean(flag).toLowerCase() === "true";
}

function formattedFrom(config: EmailConfig): string {
  return `${config.fromName} <${config.fromEmail}>`;
}

function timeoutSignal(): AbortSignal | undefined {
  return typeof AbortSignal.timeout === "function" ? AbortSignal.timeout(10_000) : undefined;
}

/**
 * Send one message through Resend or Brevo. Failures return a short, safe
 * status string; the caller decides whether to surface it. Provider response
 * bodies are not returned because they can echo recipient addresses.
 */
export async function sendEmail(
  message: EmailMessage,
  config: EmailConfig,
  fetcher: typeof fetch = fetch,
): Promise<EmailResult> {
  const headers: Record<string, string> = { "content-type": "application/json" };

  let url: string;
  let body: Record<string, unknown>;

  if (config.provider === "resend") {
    url = "https://api.resend.com/emails";
    headers.authorization = `Bearer ${config.apiKey}`;
    body = {
      from: formattedFrom(config),
      to: [message.to],
      subject: message.subject,
      text: message.text,
      ...(message.html ? { html: message.html } : {}),
    };
  } else {
    url = "https://api.brevo.com/v3/smtp/email";
    headers["api-key"] = config.apiKey;
    headers.accept = "application/json";
    body = {
      sender: { name: config.fromName, email: config.fromEmail },
      to: [{ email: message.to }],
      subject: message.subject,
      textContent: message.text,
      ...(message.html ? { htmlContent: message.html } : {}),
    };
  }

  try {
    const response = await fetcher(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: timeoutSignal(),
    });
    if (!response.ok) {
      return { ok: false, error: `${config.provider} responded with ${response.status}.` };
    }
    return { ok: true };
  } catch (error) {
    const reason = error instanceof Error ? error.message : "network error";
    return { ok: false, error: `${config.provider} request failed: ${reason}` };
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** One-hour reset email. The URL is built by the caller from SITE_URL. */
export function buildPasswordResetEmail(
  to: string,
  resetUrl: string,
  siteName = "CUET Free Mock Test",
): EmailMessage {
  const safeSite = siteName.trim() || "CUET Free Mock Test";
  const safeUrl = escapeHtml(resetUrl);
  const text = [
    `We received a request to reset the password for your ${safeSite} account.`,
    "",
    "Open this link within one hour to choose a new password:",
    resetUrl,
    "",
    "If you did not request this, ignore this email. Your password will not change.",
  ].join("\n");

  const html = [
    `<p>We received a request to reset the password for your ${escapeHtml(safeSite)} account.</p>`,
    `<p><a href="${safeUrl}">Choose a new password</a>. This link expires in one hour.</p>`,
    `<p>If you did not request this, ignore this email. Your password will not change.</p>`,
  ].join("");

  return {
    to,
    subject: `Reset your ${safeSite} password`,
    text,
    html,
  };
}
