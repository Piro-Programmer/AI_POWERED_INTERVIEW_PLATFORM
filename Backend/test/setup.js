// Runs before every test file: test env vars, then a fresh in-memory MongoDB.
import { afterAll, afterEach, beforeAll } from "vitest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";

process.env.JWT_SECRET = "test-secret";
process.env.AI_DAILY_LIMIT = "3";
process.env.AI_DAILY_REVIEW_LIMIT = "3";
process.env.TRUST_PROXY_HOPS = "0";
process.env.NODE_ENV = "test";
delete process.env.GROQ_API_KEY;

let mongod;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  // build every model's indexes (incl. the unique quota index) before tests
  await mongoose.syncIndexes();
});

afterEach(async () => {
  const { collections } = mongoose.connection;
  await Promise.all(Object.values(collections).map((c) => c.deleteMany({})));
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod?.stop();
});
