import mongoose from "mongoose";

// One document per user, per UTC day, per kind of AI call.
const aiUsageSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "users",
    required: true
  },
  day: {
    type: String, // "YYYY-MM-DD" in UTC
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
    default: Date.now,
    expires: 60 * 60 * 24 * 7 // old days remove themselves after a week
  }
});

// Unique per user, day and kind: this is what makes the quota check atomic.
aiUsageSchema.index({ user: 1, day: 1, kind: 1 }, { unique: true });

const aiUsageModel = mongoose.model("AiUsage", aiUsageSchema);

export default aiUsageModel;
