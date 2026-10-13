import jwt from "jsonwebtoken";
import tokenBlacklistModel from "../models/blacklist.model.js";
import userModel from "../models/user.model.js";

async function authUser(req, res, next) {
  const token = req.cookies.token;

  if (!token) {
    return res.status(401).json({
      message: "Token not provided"
    });
  }

  // Signature and expiry first: it's free, and a bad token never reaches the database
  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return res.status(401).json({
      message: "Invalid token."
    });
  }

  // Both lookups at once: was this token logged out, and does the account
  // still exist with no password change since the token was issued?
  const [isTokenBlacklisted, user] = await Promise.all([
    tokenBlacklistModel.exists({ token }),
    userModel.findById(decoded.id).select("passwordChangedAt").lean()
  ]);

  if (isTokenBlacklisted) {
    return res.status(401).json({
      message: "token is invalid"
    });
  }

  // A deleted account, or a session from before the latest password change
  if (!user || (user.passwordChangedAt && decoded.iat * 1000 < user.passwordChangedAt.getTime())) {
    return res.status(401).json({
      message: "Your session has ended. Please sign in again."
    });
  }

  req.user = decoded;
  next();
}

export default { authUser };
