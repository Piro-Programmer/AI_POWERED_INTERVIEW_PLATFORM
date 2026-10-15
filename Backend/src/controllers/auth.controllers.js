import userModel from "../models/user.model.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import tokenBlacklistModel from "../models/blacklist.model.js";
import { deleteUserAndData } from "../services/userData.service.js";
import passwordResetModel from "../models/passwordReset.model.js";
import { EmailNotConfiguredError, isEmailEnabled, sendEmail } from "../services/mail.service.js";

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
 * Sign `user` in: a 1-day JWT in an httpOnly cookie. `iat` (seconds) is only
 * passed after a password change, see changePasswordController.
 */
function startSession(res, user, iat) {
  // jwtid makes every token unique: without it, two sign-ins in the same
  // second produce the identical token, and revoking one revokes both.
  const token = jwt.sign(
    { id: user._id, username: user.username, ...(iat && { iat }) },
    process.env.JWT_SECRET,
    { expiresIn: "1d", jwtid: randomUUID() }
  );

  res.cookie("token", token, {
    ...cookieOptions,
    maxAge: 24 * 60 * 60 * 1000
  });
}

/** Blacklist a token until it would have expired anyway. */
async function revokeToken(token) {
  const exp = jwt.decode(token)?.exp;
  const expiresAt = typeof exp === "number" ? new Date(exp * 1000) : undefined;
  await tokenBlacklistModel.updateOne(
    { token },
    { $setOnInsert: { token, ...(expiresAt && { expiresAt }) } },
    { upsert: true, setDefaultsOnInsert: true }
  );
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

  startSession(res, user);

  res.status(201).json({
    message: "User registerd successfullty",
    user: {
      id: user._id,
      username: user.username,
      email: user.email,
      role: user.role || "user"
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

  startSession(res, user);
  res.status(200).json({
    message: "User loggedIn successfully",
    user: {
      id: user._id,
      username: user.username,
      email: user.email,
      role: user.role || "user"
    }
  });
}

async function logoutUserController(req, res) {
  const token = req.cookies.token;

  if (token) {
    await revokeToken(token);
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
      email: user.email,
      role: user.role || "user"
    }
  });
}

/**
 * @name changePasswordController
 * @description Change the password. Expects { currentPassword, newPassword }.
 *              Every other session is signed out; this one gets a fresh token.
 * @access private (wrong current passwords rate limited)
 */
async function changePasswordController(req, res) {
  const { currentPassword, newPassword } = req.body || {};

  if (typeof currentPassword !== "string" || typeof newPassword !== "string" || !currentPassword) {
    return res.status(400).json({ message: "Please provide your current password and a new password." });
  }

  const passwordProblem = checkPassword(newPassword);
  if (passwordProblem) {
    return res.status(400).json({ message: passwordProblem });
  }
  if (newPassword === currentPassword) {
    return res.status(400).json({ message: "The new password must be different from the current one." });
  }

  const user = await userModel.findById(req.user.id);
  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }

  // 401 (not 400) so the rate limiter counts it as a failed attempt
  if (!(await bcrypt.compare(currentPassword, user.password))) {
    return res.status(401).json({ message: "Current password is incorrect." });
  }

  // JWT iat has one-second resolution. Using the *next* whole second means
  // every token issued so far (even earlier this second) is older than the
  // change, while this device's new token, stamped with that second, isn't.
  const changedAt = Math.ceil(Date.now() / 1000);
  user.password = await bcrypt.hash(newPassword, 10);
  user.passwordChangedAt = new Date(changedAt * 1000);
  await user.save();

  await revokeToken(req.cookies.token);
  startSession(res, user, changedAt);

  res.status(200).json({ message: "Password changed. Other devices have been signed out." });
}

/**
 * @name deleteAccountController
 * @description Delete the account and everything stored for it (reports,
 *              practice answers, usage counters). Expects { password }.
 * @access private (wrong passwords rate limited)
 */
async function deleteAccountController(req, res) {
  const { password } = req.body || {};

  if (typeof password !== "string" || !password) {
    return res.status(400).json({ message: "Please enter your password to confirm." });
  }

  const user = await userModel.findById(req.user.id);
  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }

  if (!(await bcrypt.compare(password, user.password))) {
    return res.status(401).json({ message: "Password is incorrect." });
  }

  await deleteUserAndData(user._id);
  await revokeToken(req.cookies.token);
  res.clearCookie("token", cookieOptions);

  res.status(200).json({ message: "Your account and all its data have been deleted." });
}

// ---------------------------------------------------------------------------
// Password reset by email

const RESET_MINUTES = 30;
const RESET_TOKEN = /^[A-Za-z0-9_-]{43}$/; // 32 random bytes as base64url
const hashToken = (token) => createHash("sha256").update(token).digest("hex");

// Where the emailed link points: APP_URL, else the first allowed frontend origin.
const appUrl = () =>
  (process.env.APP_URL || (process.env.CLIENT_URL || "http://localhost:5173").split(",")[0]).trim().replace(/\/$/, "");

const FORGOT_REPLY = "If an account exists for that email, a reset link is on its way. It works for 30 minutes.";

/**
 * @name forgotPasswordController
 * @description Email a one-time reset link. Expects { email }. Always gives the
 *              same answer, so it can't be used to find out who has an account.
 * @access Public (rate limited per network and per email)
 */
async function forgotPasswordController(req, res) {
  const { email } = req.body || {};
  if (typeof email !== "string" || !email.trim()) {
    return res.status(400).json({ message: "Please enter your email address." });
  }
  if (!isEmailEnabled()) {
    return res.status(503).json({ code: "EMAIL_DISABLED", message: "Password reset by email isn't set up on this site yet." });
  }

  try {
    const user = await userModel.findOne({ email: email.trim() }).select("username email").lean();
    if (user) {
      const token = randomBytes(32).toString("base64url");
      await passwordResetModel.findOneAndUpdate(
        { user: user._id },
        { tokenHash: hashToken(token), expiresAt: new Date(Date.now() + RESET_MINUTES * 60 * 1000) },
        { upsert: true }
      );

      const link = `${appUrl()}/reset-password?token=${token}`;
      await sendEmail({
        to: user.email,
        subject: "Reset your Interview Lab password",
        text: `Hi ${user.username},\n\nSomeone (hopefully you) asked to reset the password for your Interview Lab account.\n\nSet a new password here (the link works for ${RESET_MINUTES} minutes, once):\n${link}\n\nIf it wasn't you, ignore this email: your password stays the same.`,
        html: `<p>Hi ${escapeHtml(user.username)},</p><p>Someone (hopefully you) asked to reset the password for your Interview Lab account.</p><p><a href="${link}">Set a new password</a>. The link works for ${RESET_MINUTES} minutes, once.</p><p>If it wasn't you, ignore this email: your password stays the same.</p>`
      });
    }
  } catch (err) {
    // log it, but answer the same way so the reply never reveals anything
    console.error("forgotPassword failed:", err instanceof EmailNotConfiguredError ? "email not configured" : err.message);
  }

  return res.status(200).json({ message: FORGOT_REPLY });
}

const escapeHtml = (text = "") =>
  String(text).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

/**
 * @name resetPasswordController
 * @description Set a new password with an emailed token. Expects { token, password }.
 *              The link works once; every existing session is signed out.
 * @access Public (rate limited per network)
 */
async function resetPasswordController(req, res) {
  const { token, password } = req.body || {};
  const invalid = () =>
    res.status(400).json({ code: "RESET_INVALID", message: "This reset link is invalid or has expired. Ask for a new one." });

  if (typeof token !== "string" || !RESET_TOKEN.test(token)) return invalid();
  if (typeof password !== "string") {
    return res.status(400).json({ message: "Please enter a new password." });
  }
  const passwordProblem = checkPassword(password);
  if (passwordProblem) {
    return res.status(400).json({ message: passwordProblem });
  }

  // take the reset atomically, so the same link can't be used twice
  const reset = await passwordResetModel.findOneAndDelete({ tokenHash: hashToken(token), expiresAt: { $gt: new Date() } }).lean();
  if (!reset) return invalid();

  const user = await userModel.findById(reset.user);
  if (!user) return invalid();

  user.password = await bcrypt.hash(password, 10);
  // the next whole second: every session issued so far is signed out
  user.passwordChangedAt = new Date(Math.ceil(Date.now() / 1000) * 1000);
  await user.save();

  return res.status(200).json({ message: "Your password has been changed. Sign in with the new one." });
}

export default {
  forgotPasswordController,
  resetPasswordController,
  registerUserController,
  loginUserController,
  logoutUserController,
  getMeController,
  changePasswordController,
  deleteAccountController
};
