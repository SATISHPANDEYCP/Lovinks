import express from "express";
import {
	checkAuth,
	deleteAccount,
	login,
	logout,
	requestPasswordResetOtp,
	resendLoginOtp,
	resendPasswordResetOtp,
	resetPasswordWithOtp,
	signup,
	verifyLoginOtp,
	updateEncryptionPublicKey,
	getEncryptionPublicKeys,
	updateProfile,
} from "../controllers/auth.controller.js";
import { protectRoute } from "../middleware/auth.middleware.js";

const router = express.Router();

router.post("/signup", signup);
router.post("/login", login);
router.post("/verify-login-otp", verifyLoginOtp);
router.post("/resend-login-otp", resendLoginOtp);
router.post("/forgot-password", requestPasswordResetOtp);
router.post("/forgot-password/resend-otp", resendPasswordResetOtp);
router.post("/forgot-password/reset", resetPasswordWithOtp);
router.post("/logout", logout);

router.put("/update-profile", protectRoute, updateProfile);
router.put("/encryption-public-key", protectRoute, updateEncryptionPublicKey);
router.get("/e2ee-public-keys/:userId", protectRoute, getEncryptionPublicKeys);
router.delete("/delete-account", protectRoute, deleteAccount);

router.get("/check", protectRoute, checkAuth);

export default router;
