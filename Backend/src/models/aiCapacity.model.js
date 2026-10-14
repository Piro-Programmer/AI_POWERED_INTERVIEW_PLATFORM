import mongoose from "mongoose";

// Site-wide AI call counters, one document per time window, e.g.
// "minute:2026-10-14T10:05" or "day:2026-10-14". Shared by every user and
// every server instance, so the cap holds even with several backends.
const aiCapacitySchema = new mongoose.Schema({
  window: {
    type: String,
    required: true,
    unique: true // what makes taking a slot atomic (see aiCapacity.service.js)
  },
  count: {
    type: Number,
    default: 0,
    min: 0
  },
  // old windows remove themselves
  expiresAt: {
    type: Date,
    required: true
  }
});

aiCapacitySchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const aiCapacityModel = mongoose.model("AiCapacity", aiCapacitySchema);

export default aiCapacityModel;
