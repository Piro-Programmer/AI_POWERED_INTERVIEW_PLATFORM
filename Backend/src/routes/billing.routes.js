import express from "express";
import authMiddleware from "../middlewares/auth.middleware.js";
import billingController from "../controllers/billing.controller.js";
import { billingLimiter } from "../middlewares/rateLimit.middleware.js";

const billingRouter = express.Router();

// POST /api/billing/webhook is mounted in app.js, ahead of express.json,
// because its signature is checked against the raw body.

/**
 * @route GET /api/billing/plans
 * @description the plan catalogue (Free / Pro / Premium) for the pricing page
 * @access public
 */
billingRouter.get("/plans", billingController.getPlansController);

/**
 * @route GET /api/billing/me
 * @description current plan, subscription status, billing period and usage
 * @access private
 */
billingRouter.get("/me", authMiddleware.authUser, billingController.getMyBillingController);

/**
 * @route POST /api/billing/subscribe
 * @description start Razorpay checkout for a paid plan, returns { subscriptionId, keyId }
 * @access private
 */
billingRouter.post("/subscribe", authMiddleware.authUser, billingLimiter, billingController.subscribeController);

/**
 * @route POST /api/billing/verify
 * @description confirm checkout with Razorpay's signature
 * @access private
 */
billingRouter.post("/verify", authMiddleware.authUser, billingLimiter, billingController.verifyController);

/**
 * @route POST /api/billing/cancel
 * @description cancel at the end of the paid period
 * @access private
 */
billingRouter.post("/cancel", authMiddleware.authUser, billingLimiter, billingController.cancelController);

/**
 * @route POST /api/billing/resume
 * @description undo a pending cancellation
 * @access private
 */
billingRouter.post("/resume", authMiddleware.authUser, billingLimiter, billingController.resumeController);

/**
 * @route POST /api/billing/change-plan
 * @description upgrade now or downgrade at the end of the period
 * @access private
 */
billingRouter.post("/change-plan", authMiddleware.authUser, billingLimiter, billingController.changePlanController);

/**
 * @route GET /api/billing/invoices
 * @description the user's payments
 * @access private
 */
billingRouter.get("/invoices", authMiddleware.authUser, billingController.getInvoicesController);

export default billingRouter;
