// Outgoing email through the Gmail API, sent from your own Gmail account over
// HTTPS (Render's free plan blocks SMTP ports, so Gmail SMTP isn't an option).
// Plain fetch, no SDK:
//   1. trade the long-lived refresh token for a short-lived access token
//      (https://developers.google.com/identity/protocols/oauth2/web-server#offline)
//   2. send a raw MIME message (https://developers.google.com/gmail/api/reference/rest/v1/users.messages/send)
// The refresh token comes from scripts/getGmailRefreshToken.js. Without all
// four values, email is off and the features that need it say so instead of failing.

const REQUIRED = ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GOOGLE_REFRESH_TOKEN", "EMAIL_FROM"];

export const isEmailEnabled = () => REQUIRED.every((name) => Boolean(process.env[name]));

export class EmailNotConfiguredError extends Error {
  constructor() {
    super("Email isn't set up on this site.");
    this.name = "EmailNotConfiguredError";
    this.code = "EMAIL_DISABLED";
  }
}

const TIMEOUT_MS = 10_000;
let cached = { token: null, expiresAt: 0 };

/** For tests: forget the cached access token. */
export const resetMailTokenCache = () => {
  cached = { token: null, expiresAt: 0 };
};

async function accessToken() {
  // reuse the token until a minute before it expires (they last an hour)
  if (cached.token && Date.now() < cached.expiresAt - 60_000) return cached.token;

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
      grant_type: "refresh_token"
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS)
  });
  if (!response.ok) {
    // invalid_grant here usually means the refresh token was revoked, or the
    // OAuth app is still in "Testing" (its tokens expire after 7 days)
    const detail = await response.text().catch(() => "");
    throw new Error(`Google token endpoint answered ${response.status}: ${detail.slice(0, 200)}`);
  }
  const data = await response.json();
  cached = { token: data.access_token, expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000 };
  return cached.token;
}

// Header values with non-ASCII text (like a name in the From line) are
// RFC 2047 encoded; plain ASCII is left readable.
const encodeHeader = (value) =>
  /^[\x20-\x7e]*$/.test(value) ? value : `=?UTF-8?B?${Buffer.from(value, "utf8").toString("base64")}?=`;

/** A multipart/alternative MIME message (plain text + HTML), base64url-encoded for the Gmail API. */
export function buildRawMessage({ from, to, subject, text, html }) {
  const boundary = `alt_${Math.random().toString(36).slice(2)}`;
  const part = (type, body) =>
    [`--${boundary}`, `Content-Type: ${type}; charset=UTF-8`, "Content-Transfer-Encoding: base64", "", Buffer.from(body, "utf8").toString("base64")].join("\r\n");

  const message = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${encodeHeader(subject)}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    "",
    part("text/plain", text),
    ...(html ? [part("text/html", html)] : []),
    `--${boundary}--`,
    ""
  ].join("\r\n");

  return Buffer.from(message, "utf8").toString("base64url");
}

/** Send one email. Throws if email is off or Google refuses it. */
export async function sendEmail({ to, subject, text, html }) {
  if (!isEmailEnabled()) throw new EmailNotConfiguredError();

  const token = await accessToken();
  const response = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ raw: buildRawMessage({ from: process.env.EMAIL_FROM, to, subject, text, html }) }),
    signal: AbortSignal.timeout(TIMEOUT_MS)
  });

  if (!response.ok) {
    if (response.status === 401) resetMailTokenCache(); // let the next send fetch a fresh token
    const detail = await response.text().catch(() => "");
    throw new Error(`Gmail API answered ${response.status}: ${detail.slice(0, 200)}`);
  }
}
