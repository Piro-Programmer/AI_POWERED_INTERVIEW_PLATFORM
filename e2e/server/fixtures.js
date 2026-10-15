import { tmpdir } from "node:os";
import { join } from "node:path";

// Test-only account seeded by start-backend.mjs into the in-memory database.
export const E2E_ADMIN = { email: "e2e-admin@example.test", password: "e2e-admin-123" };

// Where the fake mail service writes emails (one JSON per line).
export const OUTBOX = join(tmpdir(), "interview-lab-e2e-outbox.jsonl");
