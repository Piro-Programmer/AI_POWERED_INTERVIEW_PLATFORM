import { Router } from "express";
import authController from "../controllers/auth.controllers.js";
import authMiddleware from "../middlewares/auth.middleware.js";
import { loginAccountLimiter, loginIpLimiter, registerLimiter } from "../middlewares/rateLimit.middleware.js";

const authRouter = Router();

/**
 * @route POST /api/auth/register
 * @description Register a new user
 * @access Public (rate limited per IP)
 */
authRouter.post("/register", registerLimiter, authController.registerUserController);

/**
 * @route POST /api/auth/login
 * @description login user with email and password
 * @access Public (failed attempts rate limited per IP and per account)
 */
authRouter.post("/login", loginIpLimiter, loginAccountLimiter, authController.loginUserController);

/**
 * @route GET /api/auth/logout
 * @description clear token from user cookie and add the token in blacklist
 * @access Public
 */
authRouter.get("/logout", authController.logoutUserController);

/**
 * @route GET /api/auth/get-me
 * @description get the current logged in userd details
 * @access private
 */
authRouter.get("/get-me", authMiddleware.authUser, authController.getMeController);

export default authRouter;
