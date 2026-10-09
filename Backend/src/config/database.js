import mongoose from "mongoose";
import aiUsageModel from "../models/aiUsage.model.js";
import tokenBlacklistModel from "../models/blacklist.model.js";
import interviewReportModel from "../models/interviewReport.model.js";

const DAY_MS = 24 * 60 * 60 * 1000;

// Throws when the database can't be reached, so the server never starts
// half-working (server.js exits and the host restarts it).
async function connectToDB() {
  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 10_000 });
  console.log("Connected to Database");

  // The usage counter's unique index changed from {user, day} to
  // {user, day, kind}; drop the old one so review counters can coexist.
  await aiUsageModel.syncIndexes();
  // Adds the token lookup index and the TTL index that expires old entries.
  await tokenBlacklistModel.syncIndexes();

  // One-off cleanups for data saved before these rules existed; both are
  // no-ops once nothing matches.
  await Promise.all([
    // blacklist entries without expiresAt would never be removed by the TTL index
    tokenBlacklistModel.updateMany(
      { expiresAt: { $exists: false } },
      [{ $set: { expiresAt: { $add: [{ $ifNull: ["$createdAt", "$$NOW"] }, DAY_MS] } } }]
    ),
    // resume text is only needed for the AI call, never stored afterwards
    interviewReportModel.updateMany({ resume: { $exists: true } }, { $unset: { resume: "" } })
  ]);
}

/** True when the app can talk to MongoDB right now. */
export const isDBConnected = () => mongoose.connection.readyState === 1;

export default connectToDB;
