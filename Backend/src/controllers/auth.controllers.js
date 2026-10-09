import userModel from "../models/user.model.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import tokenBlacklistModel from "../models/blacklist.model.js";

// In production the cookie is only sent over HTTPS. SameSite defaults to "lax",
// which works when the frontend proxies /api to this server (same site).
// Set COOKIE_SAMESITE=none only if the frontend calls this API cross-site.
const isProduction = process.env.NODE_ENV === "production";
const sameSite = (process.env.COOKIE_SAMESITE || "lax").toLowerCase();

const cookieOptions = {
  httpOnly: true,
  secure: isProduction || sameSite === "none",
  sameSite,
  path: "/"
};

// bcrypt ignores everything past 72 bytes, so longer passwords aren't safer.
const PASSWORD_MIN = 8;
const PASSWORD_MAX = 72;

/** Returns a message describing what's wrong with the password, or null. */
export function checkPassword(password) {
  if (password.length < PASSWORD_MIN) return `Password must be at least ${PASSWORD_MIN} characters.`;
  if (Buffer.byteLength(password) > PASSWORD_MAX) return `Password must be at most ${PASSWORD_MAX} characters.`;
  if (!/[a-z]/i.test(password) || !/\d/.test(password)) return "Password must contain a letter and a number.";
  return null;
}

/**
 * @name registerUserController
 * @description register a new user,ecpects username, email, password in the request
 * @access Public
 */

async function registerUserController(req, res) {
  const { username, email, password } = req.body || {};

  // Strings only: an object like { "$gt": "" } must never reach a Mongo query
  if (
    [username, email, password].some((value) => typeof value !== "string" || !value.trim())
  ) {
    return res.status(400).json({
      message: "Please provide username, email and password"
    });
  }

  const passwordProblem = checkPassword(password);
  if (passwordProblem) {
    return res.status(400).json({ message: passwordProblem });
  }

  const isUserAlreadyExists = await userModel.findOne({
    $or: [{ username }, { email }]
  });

  if (isUserAlreadyExists) {
    return res.status(400).json({
      message: "Account already exists with this email address or username"
    });
  }

  const hash = await bcrypt.hash(password, 10);

  const user = await userModel.create({
    username,
    email,
    password: hash
  });

  const token = jwt.sign(
    { id: user._id, username: user.username },
    process.env.JWT_SECRET,
    { expiresIn: "1d" }
  );

  res.cookie("token", token, {
    ...cookieOptions,
    maxAge: 24 * 60 * 60 * 1000
  });

  res.status(201).json({
    message: "User registerd successfullty",
    user: {
      id: user._id,
      username: user.username,
      email: user.email
    }
  });
}

/**
 * @name loginUSerController
 * @description login a user,expects email and password in the request body
 * @access Public
 */
async function loginUserController(req, res) {
  const { email, password } = req.body || {};

  // Without this, findOne({ email: undefined }) matches the first user and
  // bcrypt then throws on the missing password
  if (typeof email !== "string" || typeof password !== "string" || !email || !password) {
    return res.status(400).json({
      message: "Please provide email and password"
    });
  }

  const user = await userModel.findOne({ email });
  if (!user) {
    return res.status(400).json({
      message: "Invalid email or password"
    });
  }

  const isPasswordValid = await bcrypt.compare(password, user.password);

  if (!isPasswordValid) {
    return res.status(400).json({
      message: "Invalid email or password"
    });
  }

  const token = jwt.sign(
    { id: user._id, username: user.username },
    process.env.JWT_SECRET,
    { expiresIn: "1d" }
  );

  res.cookie("token", token, {
    ...cookieOptions,
    maxAge: 24 * 60 * 60 * 1000
  });
  res.status(200).json({
    message: "User loggedIn successfully",
    user: {
      id: user._id,
      username: user.username,
      email: user.email
    }
  });
}

async function logoutUserController(req, res) {
  const token = req.cookies.token;

  if (token) {
    // Keep the entry only as long as the token could still be used
    const exp = jwt.decode(token)?.exp;
    const expiresAt = typeof exp === "number" ? new Date(exp * 1000) : undefined;
    await tokenBlacklistModel.updateOne(
      { token },
      { $setOnInsert: { token, ...(expiresAt && { expiresAt }) } },
      { upsert: true, setDefaultsOnInsert: true }
    );
  }

  res.clearCookie("token", cookieOptions);

  res.status(200).json({
    message: "User logged out successfully"
  });
}

/**
 * @name getMeController
 * @description get the current logged in user details
 * @access private
 */

async function getMeController(req, res) {
  const user = await userModel.findById(req.user.id);

  if (!user) {
    return res.status(404).json({
      message: "User not found"
    });
  }

  res.status(200).json({
    message: "User details fetched successfully",
    user: {
      id: user._id,
      username: user.username,
      email: user.email
    }
  });
}

export default {
  registerUserController,
  loginUserController,
  logoutUserController,
  getMeController
};
