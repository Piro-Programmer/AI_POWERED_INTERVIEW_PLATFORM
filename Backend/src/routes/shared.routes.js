import express from "express";
import interviewController from "../controllers/interview.controller.js";

const sharedRouter = express.Router();

/**
 * @route GET /api/shared/:token
 * @description a report opened through its read-only share link
 * @access public (only reports whose owner turned sharing on; per-IP API limit applies)
 */
sharedRouter.get("/:token", interviewController.getSharedReportController);

export default sharedRouter;
