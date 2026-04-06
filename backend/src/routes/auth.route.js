import express from "express";
import {
	checkAuth,
	deleteAccount,
	login,
	logout,
	resendLoginOtp,
	signup,
	verifyLoginOtp,
	updateEncryptionPublicKey,
	updateProfile,
} from "../controllers/auth.controller.js";
import { protectRoute } from "../middleware/auth.middleware.js";

const router = express.Router();

router.post("/signup", signup);
router.post("/login", login);
router.post("/verify-login-otp", verifyLoginOtp);
router.post("/resend-login-otp", resendLoginOtp);
router.post("/logout", logout);

router.put("/update-profile", protectRoute, updateProfile);
router.put("/encryption-public-key", protectRoute, updateEncryptionPublicKey);
router.delete("/delete-account", protectRoute, deleteAccount);

router.get("/check", protectRoute, checkAuth);

export default router;
