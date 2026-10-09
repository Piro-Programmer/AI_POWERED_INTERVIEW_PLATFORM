import mongoose from "mongoose";

const blacklistTokenSchema = new mongoose.Schema({
  token: {
    type: String,
    required: [true, "token is requi to be added in blacklist"],
    index: true // every authenticated request looks the token up
  },
  // When the JWT itself expires. After that the token is useless anyway,
  // so the TTL index below lets MongoDB delete the entry on its own.
  expiresAt: {
    type: Date,
    required: true,
    default: () => new Date(Date.now() + 24 * 60 * 60 * 1000)
  }
}, {
  timestamps: true
});

blacklistTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const tokenBlacklistModel = mongoose.model("blacklistTokens", blacklistTokenSchema);

export default tokenBlacklistModel;
