import mongoose from "mongoose";

// One pending password reset per user. Only a SHA-256 hash of the emailed
// token is stored, so a copy of the database can't be used to reset anyone.
const passwordResetSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "users",
    required: true,
    unique: true // a new request replaces the old link
  },
  tokenHash: {
    type: String,
    required: true,
    index: true
  },
  // removed by MongoDB once expired
  expiresAt: {
    type: Date,
    required: true
  }
});

passwordResetSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const passwordResetModel = mongoose.model("PasswordReset", passwordResetSchema);

export default passwordResetModel;
