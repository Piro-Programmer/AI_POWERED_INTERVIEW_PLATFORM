// Stands in for Backend/src/services/mail.service.js during end-to-end tests:
// instead of sending, each email is appended to the outbox file, one JSON per
// line, where the tests can read it.
import { appendFileSync } from "node:fs";
import { OUTBOX } from "./fixtures.js";

export const isEmailEnabled = () => true;

export class EmailNotConfiguredError extends Error {}

export async function sendEmail(email) {
  appendFileSync(OUTBOX, `${JSON.stringify({ ...email, sentAt: new Date().toISOString() })}\n`);
}
