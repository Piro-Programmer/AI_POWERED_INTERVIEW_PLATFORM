// Outgoing email through Resend's HTTP API (https://resend.com/docs/api-reference/emails/send-email).
// Plain fetch, no SDK. Without RESEND_API_KEY and EMAIL_FROM, email is off and
// the features that need it say so instead of failing.

export const isEmailEnabled = () => Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);

export class EmailNotConfiguredError extends Error {
  constructor() {
    super("Email isn't set up on this site.");
    this.name = "EmailNotConfiguredError";
    this.code = "EMAIL_DISABLED";
  }
}

/** Send one email. Throws if email is off or the provider refuses it. */
export async function sendEmail({ to, subject, text, html }) {
  if (!isEmailEnabled()) throw new EmailNotConfiguredError();

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ from: process.env.EMAIL_FROM, to: [to], subject, text, html }),
    signal: AbortSignal.timeout(10_000)
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Email provider answered ${response.status}: ${detail.slice(0, 200)}`);
  }
}
