import { env } from "cloudflare:workers";
import {
  emailConfig,
  sendEmail,
  type EmailConfig,
  type EmailMessage,
  type EmailResult,
} from "./email-config";

/**
 * Worker-bound email helpers. The pure provider logic lives in
 * `email-config.ts` so it can be tested outside a Workers runtime.
 */

export function currentEmailConfig(): EmailConfig | null {
  return emailConfig(env);
}

export function emailConfigured(): boolean {
  return currentEmailConfig() !== null;
}

export async function sendEmailWithEnv(message: EmailMessage): Promise<EmailResult> {
  const config = currentEmailConfig();
  if (!config) {
    return { ok: false, error: "No transactional email provider is configured." };
  }
  return sendEmail(message, config);
}
