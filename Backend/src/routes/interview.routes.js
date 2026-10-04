import express from "express";
import authMiddleware from "../middlewares/auth.middleware.js";
import interviewController from "../controllers/interview.controller.js";
import upload from "../middlewares/file.middleware.js";
import { generateLimiter, progressLimiter } from "../middlewares/rateLimit.middleware.js";

const interviewRouter = express.Router();

/**
 * @route POST /api/interview/
 * @description generate new interview report on the basis of user self description, resume, and job description
 * @access private (rate limited, uses one of the daily AI allowance)
 */
interviewRouter.post(
  "/",
  authMiddleware.authUser,
  generateLimiter,
  upload.single("resume"),
  interviewController.generateInterviewReportController
);

/**
 * @route GET /api/interview/
 * @description list the logged-in user's past interview reports
 * @access private
 */
interviewRouter.get(
  "/",
  authMiddleware.authUser,
  interviewController.getMyReportsController
);

/**
 * @route GET /api/interview/usage
 * @description how many AI reports the user has left today
 * @access private
 * Declared before "/:id" so "usage" isn't treated as a report id.
 */
interviewRouter.get(
  "/usage",
  authMiddleware.authUser,
  interviewController.getUsageController
);

/**
 * @route GET /api/interview/:id
 * @description get one of the logged-in user's reports in full
 * @access private
 */
interviewRouter.get(
  "/:id",
  authMiddleware.authUser,
  interviewController.getReportByIdController
);

/**
 * @route PATCH /api/interview/:id/progress
 * @description save which preparation-plan tasks are ticked
 * @access private (rate limited)
 */
interviewRouter.patch(
  "/:id/progress",
  authMiddleware.authUser,
  progressLimiter,
  interviewController.updateProgressController
);

export default interviewRouter;
