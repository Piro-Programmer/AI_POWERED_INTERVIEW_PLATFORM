import express from "express";
import authMiddleware from "../middlewares/auth.middleware.js";
import adminController from "../controllers/admin.controller.js";

const adminRouter = express.Router();

// Everything here: signed in, and role "admin" in the database
adminRouter.use(authMiddleware.authUser, authMiddleware.requireAdmin);

/**
 * @route GET /api/admin/stats
 * @description site totals, sign-ups and reports in the last 7 days, today's AI usage
 */
adminRouter.get("/stats", adminController.getAdminStatsController);

/**
 * @route GET /api/admin/users
 * @description users newest first with report/practice counts (?page, ?q)
 */
adminRouter.get("/users", adminController.listUsersController);

/**
 * @route DELETE /api/admin/users/:id
 * @description delete a user and all their data (not yourself, not an admin); audited
 */
adminRouter.delete("/users/:id", adminController.deleteUserController);

/**
 * @route GET /api/admin/audit
 * @description the latest 50 admin actions
 */
adminRouter.get("/audit", adminController.getAuditLogController);

export default adminRouter;
