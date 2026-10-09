import { describe, expect, it } from "vitest";
import mongoose from "mongoose";
import connectToDB from "../src/config/database.js";
import tokenBlacklistModel from "../src/models/blacklist.model.js";
import interviewReportModel from "../src/models/interviewReport.model.js";
import { createReport, createUser } from "./helpers.js";

describe("connectToDB startup cleanup", () => {
  it("dates old blacklist entries and removes stored resume text", async () => {
    const createdAt = new Date("2026-01-01T00:00:00Z");
    await tokenBlacklistModel.collection.insertOne({ token: "old", createdAt });
    const report = await createReport(await createUser());

    // already connected by setup.js; connect() with the same URI is a no-op
    process.env.MONGO_URI = mongoose.connection.client.s.url;
    await connectToDB();

    const entry = await tokenBlacklistModel.collection.findOne({ token: "old" });
    expect(entry.expiresAt.getTime()).toBe(createdAt.getTime() + 24 * 60 * 60 * 1000);

    const raw = await interviewReportModel.collection.findOne({ _id: report._id });
    expect(raw).not.toHaveProperty("resume");
  });
});
