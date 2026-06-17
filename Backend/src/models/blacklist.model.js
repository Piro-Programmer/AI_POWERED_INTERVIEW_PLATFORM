import mongoose from "mongoose";

const blacklistTokenSchema = new mongoose.Schema({
  token: {
    type: String,
    required: [true, "token is requi to be added in blacklist"]
  }
}, {
  timestamps: true
});

const tokenBlacklistModel = mongoose.model("blacklistTokens", blacklistTokenSchema);

export default tokenBlacklistModel;
