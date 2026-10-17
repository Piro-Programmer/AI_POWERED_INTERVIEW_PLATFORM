import express from "express";
import authMiddleware from "../middlewares/auth.middleware.js";
import billingController from "../controllers/billing.controller.js";

const billingRouter = express.Router();

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

export default billingRouter;
