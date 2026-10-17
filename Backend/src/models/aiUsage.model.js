import mongoose from "mongoose";

// One counter per user, per bucket, per kind of AI call. A bucket is either a
// UTC day ("2026-10-17", the daily cap) or a billing period ("M:2026-10" for
// a Free calendar month, "P:<period start>" for a subscription period).
const aiUsageSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "users",
    required: true
  },
  day: {
    type: String, // the bucket key (named "day" from before monthly buckets)
    required: true
  },
  kind: {
    type: String,
    enum: ["report", "review"], // report generation / practice answer review
    default: "report"
  },
  count: {
    type: Number,
    default: 0,
    min: 0
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  // Set per bucket on insert: days go after a week, periods are kept about a
  // year as usage history.
  expiresAt: {
    type: Date,
    expires: 0
  }
});

// Unique per user, bucket and kind: this is what makes the quota check atomic.
aiUsageSchema.index({ user: 1, day: 1, kind: 1 }, { unique: true });

const aiUsageModel = mongoose.model("AiUsage", aiUsageSchema);

export default aiUsageModel;
