import mongoose from "mongoose";
import userModel from "../models/user.model.js";
import interviewReportModel from "../models/interviewReport.model.js";
import practiceAttemptModel from "../models/practiceAttempt.model.js";
import adminAuditModel from "../models/adminAudit.model.js";
import { getGlobalUsage } from "../services/aiCapacity.service.js";
import { deleteUserAndData } from "../services/userData.service.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const PAGE_SIZE = 25;
const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const toInt = (value, fallback, min, max) => {
  const n = Number.parseInt(value, 10);
  return Number.isNaN(n) ? fallback : Math.min(max, Math.max(min, n));
};
// users have no createdAt; an ObjectId carries its creation time
const sinceId = (date) => mongoose.Types.ObjectId.createFromTime(Math.floor(date.getTime() / 1000));

/**
 * @name getAdminStatsController
 * @description Site totals, sign-ups in the last 7 days and today's AI usage.
 * @access admin
 */
async function getAdminStatsController(req, res) {
  try {
    const weekAgo = new Date(Date.now() - 7 * DAY_MS);
    const [users, admins, newUsers, reports, newReports, sharedReports, attempts, ai] = await Promise.all([
      userModel.estimatedDocumentCount(),
      userModel.countDocuments({ role: "admin" }),
      userModel.countDocuments({ _id: { $gte: sinceId(weekAgo) } }),
      interviewReportModel.estimatedDocumentCount(),
      interviewReportModel.countDocuments({ createdAt: { $gte: weekAgo } }),
      interviewReportModel.countDocuments({ shareToken: { $exists: true } }),
      practiceAttemptModel.estimatedDocumentCount(),
      getGlobalUsage()
    ]);

    return res.status(200).json({
      users: { total: users, admins, last7Days: newUsers },
      reports: { total: reports, last7Days: newReports, shared: sharedReports },
      practiceAttempts: { total: attempts },
      ai
    });
  } catch (err) {
    console.error("getAdminStats failed:", err.message);
    return res.status(500).json({ message: "Failed to load stats", error: err.message });
  }
}

/**
 * @name listUsersController
 * @description Users, newest first, with report and practice counts.
 *   Query: page, q (username or email).
 * @access admin
 */
async function listUsersController(req, res) {
  try {
    const page = toInt(req.query.page, 1, 1, 10000);
    const q = typeof req.query.q === "string" ? req.query.q.trim().slice(0, 100) : "";
    const match = q ? { $or: [{ username: new RegExp(escapeRegex(q), "i") }, { email: new RegExp(escapeRegex(q), "i") }] } : {};

    const [result] = await userModel.aggregate([
      { $match: match },
      {
        $facet: {
          total: [{ $count: "n" }],
          page: [
            { $sort: { _id: -1 } },
            { $skip: (page - 1) * PAGE_SIZE },
            { $limit: PAGE_SIZE },
            { $lookup: { from: "interviewreports", localField: "_id", foreignField: "user", as: "reports", pipeline: [{ $project: { _id: 1 } }] } },
            { $lookup: { from: "practiceattempts", localField: "_id", foreignField: "user", as: "attempts", pipeline: [{ $project: { _id: 1 } }] } },
            {
              $project: {
                username: 1,
                email: 1,
                role: { $ifNull: ["$role", "user"] },
                joinedAt: { $toDate: "$_id" },
                reportCount: { $size: "$reports" },
                practiceCount: { $size: "$attempts" }
              }
            }
          ]
        }
      }
    ]);

    const total = result.total[0]?.n || 0;
    return res.status(200).json({ users: result.page, page, pageSize: PAGE_SIZE, total, hasMore: page * PAGE_SIZE < total });
  } catch (err) {
    console.error("listUsers failed:", err.message);
    return res.status(500).json({ message: "Failed to load users", error: err.message });
  }
}

/**
 * @name deleteUserController
 * @description Delete a user and all their data. Not yourself (use Account),
 *              not another admin. Recorded in the audit log.
 * @access admin
 */
async function deleteUserController(req, res) {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(404).json({ message: "User not found" });
    }
    if (id === String(req.user.id)) {
      return res.status(400).json({ message: "To delete your own account, use the Account page." });
    }

    const target = await userModel.findById(id).select("username email role").lean();
    if (!target) {
      return res.status(404).json({ message: "User not found" });
    }
    if (target.role === "admin") {
      return res.status(403).json({ message: "Admins can't be deleted here. Remove their admin role in the database first." });
    }

    const [reportCount, practiceCount] = await Promise.all([
      interviewReportModel.countDocuments({ user: target._id }),
      practiceAttemptModel.countDocuments({ user: target._id })
    ]);
    await deleteUserAndData(target._id);
    await adminAuditModel.create({
      admin: req.user.id,
      adminName: req.user.username,
      action: "delete-user",
      target: target._id,
      details: { username: target.username, email: target.email, reportCount, practiceCount }
    });

    return res.status(200).json({ message: `Deleted ${target.username} and all their data.` });
  } catch (err) {
    console.error("deleteUser failed:", err.message);
    return res.status(500).json({ message: "Failed to delete user", error: err.message });
  }
}

/**
 * @name getAuditLogController
 * @description The latest 50 admin actions.
 * @access admin
 */
async function getAuditLogController(req, res) {
  try {
    const entries = await adminAuditModel.find().sort({ createdAt: -1 }).limit(50).lean();
    return res.status(200).json({ entries });
  } catch (err) {
    console.error("getAuditLog failed:", err.message);
    return res.status(500).json({ message: "Failed to load the audit log", error: err.message });
  }
}

export default {
  getAdminStatsController,
  listUsersController,
  deleteUserController,
  getAuditLogController
};
