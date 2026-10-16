import { Router } from "express";
import authController from "../controllers/auth.controllers.js";
import authMiddleware from "../middlewares/auth.middleware.js";
import { loginAccountLimiter, loginIpLimiter, passwordCheckLimiter, registerLimiter } from "../middlewares/rateLimit.middleware.js";

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

/**
 * @route PATCH /api/auth/password
 * @description change password ({ currentPassword, newPassword }); signs out other sessions
 * @access private (wrong current passwords rate limited per user)
 */
authRouter.patch("/password", authMiddleware.authUser, passwordCheckLimiter, authController.changePasswordController);

/**
 * @route DELETE /api/auth/account
 * @description delete the account and all its data ({ password } to confirm)
 * @access private (wrong passwords rate limited per user)
 */
authRouter.delete("/account", authMiddleware.authUser, passwordCheckLimiter, authController.deleteAccountController);

export default authRouter;
