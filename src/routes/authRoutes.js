import express from "express";
import {
  register,
  login,
  getProfile,
  updateProfile,
  changePassword,
  uploadAvatar,
} from "../controllers/authController.js";
import { authenticateToken } from "../middlewares/authMiddleware.js";
import { validate } from "../middlewares/validateMiddleware.js";
import { uploadAvatarMiddleware } from "../middlewares/uploadMiddleware.js";
import {
  registerSchema,
  loginSchema,
  updateProfileSchema,
  changePasswordSchema,
} from "../validators/authValidator.js";

const router = express.Router();

router.post("/register", validate(registerSchema), register);
router.post("/login", validate(loginSchema), login);

router.use(authenticateToken);

router.get("/profile", getProfile);
router.put("/profile", validate(updateProfileSchema), updateProfile);
router.put("/profile/password", validate(changePasswordSchema), changePassword);

router.post(
  "/profile/avatar",
  uploadAvatarMiddleware.single("avatar"),
  uploadAvatar,
);

export default router;
