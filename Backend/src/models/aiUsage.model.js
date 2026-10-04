import mongoose from "mongoose";

// One document per user per UTC day, counting AI report generations.
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

// Unique per user per day: this is what makes the quota check atomic.
aiUsageSchema.index({ user: 1, day: 1 }, { unique: true });

const aiUsageModel = mongoose.model("AiUsage", aiUsageSchema);

export default aiUsageModel;
