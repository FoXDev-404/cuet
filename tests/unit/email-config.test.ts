import { describe, expect, it, vi } from "vitest";
import {
  buildPasswordResetEmail,
  devResetLinkAllowed,
  emailConfig,
  parseEmailFrom,
  sendEmail,
} from "../../src/lib/email-config";

const FROM = "CUET Free Mock Test <no-reply@cuetfreemocktest.com>";

function fakeFetch(response: Response) {
  const calls: { url: string; init: RequestInit }[] = [];
  const fetcher = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(input), init: init ?? {} });
    return response;
  }) as typeof fetch;
  return { calls, fetcher };
}

describe("transactional email configuration", () => {
  it("stays unconfigured when the provider, key or sender is absent", () => {
    expect(emailConfig({})).toBeNull();
    expect(emailConfig({ EMAIL_PROVIDER: "resend" })).toBeNull();
    expect(
      emailConfig({ EMAIL_PROVIDER: "resend", RESEND_API_KEY: "re_test" }),
    ).toBeNull();
    expect(
      emailConfig({
        EMAIL_PROVIDER: "resend",
        RESEND_API_KEY: "re_test",
        EMAIL_FROM: "not-an-email",
      }),
    ).toBeNull();
    expect(
      emailConfig({
        EMAIL_PROVIDER: "smtp",
        RESEND_API_KEY: "re_test",
        EMAIL_FROM: FROM,
      }),
    ).toBeNull();
  });

  it("selects Resend or Brevo with their own key", () => {
    expect(
      emailConfig({
        EMAIL_PROVIDER: "Resend",
        RESEND_API_KEY: "re_test",
        BREVO_API_KEY: "brevo_test",
        EMAIL_FROM: FROM,
      }),
    ).toMatchObject({
      provider: "resend",
      apiKey: "re_test",
      fromName: "CUET Free Mock Test",
      fromEmail: "no-reply@cuetfreemocktest.com",
    });

    expect(
      emailConfig({
        EMAIL_PROVIDER: "brevo",
        RESEND_API_KEY: "re_test",
        BREVO_API_KEY: "brevo_test",
        EMAIL_FROM: "no-reply@cuetfreemocktest.com",
      }),
    ).toMatchObject({
      provider: "brevo",
      apiKey: "brevo_test",
      fromName: "CUET Free Mock Test",
    });
  });

  it("parses sender names and rejects header injection", () => {
    expect(parseEmailFrom(FROM)).toEqual({
      name: "CUET Free Mock Test",
      email: "no-reply@cuetfreemocktest.com",
    });
    expect(parseEmailFrom('"Support" <help@example.com>')).toEqual({
      name: "Support",
      email: "help@example.com",
    });
    expect(parseEmailFrom("no-reply@example.com")).toEqual({
      name: "CUET Free Mock Test",
      email: "no-reply@example.com",
    });
    expect(parseEmailFrom("no-reply@example.com\r\nBcc: evil@example.com")).toBeNull();
    expect(parseEmailFrom("No Name <>")).toBeNull();
  });

  it("honours DEV_SHOW_RESET_LINK only outside production", () => {
    expect(devResetLinkAllowed(false, "true")).toBe(true);
    expect(devResetLinkAllowed(false, " TRUE ")).toBe(true);
    expect(devResetLinkAllowed(true, "true")).toBe(false);
    expect(devResetLinkAllowed(false, "false")).toBe(false);
    expect(devResetLinkAllowed(false, undefined)).toBe(false);
  });

  it("builds a reset email with the one-hour link", () => {
    const message = buildPasswordResetEmail(
      "student@example.com",
      "https://cuetfreemocktest.com/reset-password/token_123",
    );
    expect(message.to).toBe("student@example.com");
    expect(message.subject).toContain("Reset");
    expect(message.text).toContain("https://cuetfreemocktest.com/reset-password/token_123");
    expect(message.text).toContain("one hour");
    expect(message.html).toContain(
      'href="https://cuetfreemocktest.com/reset-password/token_123"',
    );
  });

  it("sends a Resend payload without leaking the key into the body", async () => {
    const { calls, fetcher } = fakeFetch(new Response("", { status: 200 }));
    const result = await sendEmail(
      {
        to: "student@example.com",
        subject: "Reset your password",
        text: "Open the link.",
        html: "<p>Open the link.</p>",
      },
      {
        provider: "resend",
        apiKey: "re_secret_key",
        fromName: "CUET Free Mock Test",
        fromEmail: "no-reply@cuetfreemocktest.com",
      },
      fetcher,
    );

    expect(result).toEqual({ ok: true });
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe("https://api.resend.com/emails");
    expect(calls[0].init.headers).toMatchObject({
      authorization: "Bearer re_secret_key",
      "content-type": "application/json",
    });
    const body = JSON.parse(String(calls[0].init.body)) as Record<string, unknown>;
    expect(body).toMatchObject({
      from: "CUET Free Mock Test <no-reply@cuetfreemocktest.com>",
      to: ["student@example.com"],
      subject: "Reset your password",
      text: "Open the link.",
      html: "<p>Open the link.</p>",
    });
    expect(JSON.stringify(body)).not.toContain("re_secret_key");
  });

  it("sends a Brevo payload with the api-key header", async () => {
    const { calls, fetcher } = fakeFetch(new Response("", { status: 201 }));
    const result = await sendEmail(
      { to: "student@example.com", subject: "Reset your password", text: "Open the link." },
      {
        provider: "brevo",
        apiKey: "brevo_secret_key",
        fromName: "CUET Free Mock Test",
        fromEmail: "no-reply@cuetfreemocktest.com",
      },
      fetcher,
    );

    expect(result).toEqual({ ok: true });
    expect(calls[0].url).toBe("https://api.brevo.com/v3/smtp/email");
    expect(calls[0].init.headers).toMatchObject({ "api-key": "brevo_secret_key" });
    const body = JSON.parse(String(calls[0].init.body)) as Record<string, unknown>;
    expect(body).toMatchObject({
      sender: { name: "CUET Free Mock Test", email: "no-reply@cuetfreemocktest.com" },
      to: [{ email: "student@example.com" }],
      subject: "Reset your password",
      textContent: "Open the link.",
    });
  });

  it("returns a safe failure without provider response bodies", async () => {
    const { fetcher } = fakeFetch(
      new Response("recipient student@example.com rejected with key re_secret_key", {
        status: 422,
      }),
    );
    const result = await sendEmail(
      { to: "student@example.com", subject: "Reset", text: "Link" },
      {
        provider: "resend",
        apiKey: "re_secret_key",
        fromName: "CUET",
        fromEmail: "no-reply@example.com",
      },
      fetcher,
    );
    expect(result).toEqual({ ok: false, error: "resend responded with 422." });
    expect(JSON.stringify(result)).not.toContain("re_secret_key");
    expect(JSON.stringify(result)).not.toContain("student@example.com");
  });

  it("returns a failure when the provider cannot be reached", async () => {
    const fetcher = vi.fn(async () => {
      throw new Error("network down");
    }) as unknown as typeof fetch;
    const result = await sendEmail(
      { to: "student@example.com", subject: "Reset", text: "Link" },
      {
        provider: "brevo",
        apiKey: "brevo_secret_key",
        fromName: "CUET",
        fromEmail: "no-reply@example.com",
      },
      fetcher,
    );
    expect(result).toEqual({ ok: false, error: "brevo request failed: network down" });
  });
});
