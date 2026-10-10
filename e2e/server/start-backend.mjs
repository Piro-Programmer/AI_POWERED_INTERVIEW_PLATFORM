// The real backend (Backend/server.js) on a throwaway in-memory MongoDB, with
// the AI service swapped for a fake. Playwright starts this before the tests.
import { register } from "node:module";
import { MongoMemoryServer } from "mongodb-memory-server";

register("./hooks.mjs", import.meta.url);

const mongod = await MongoMemoryServer.create();

Object.assign(process.env, {
  PORT: process.env.E2E_API_PORT || "3100",
  MONGO_URI: mongod.getUri(),
  JWT_SECRET: "e2e-secret",
  NODE_ENV: "test", // cookies without the Secure flag, over plain http
  TRUST_PROXY_HOPS: "1", // client IP from X-Forwarded-For, like behind Vercel
  CLIENT_URL: "http://localhost:4180",
  AI_DAILY_LIMIT: "50",
  AI_DAILY_REVIEW_LIMIT: "50"
});

const stop = async () => {
  await mongod.stop();
  process.exit(0);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);

await import("../../Backend/server.js");
