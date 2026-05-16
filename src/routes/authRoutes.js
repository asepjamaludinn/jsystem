import express from "express";
import multer from "multer";
import path from "path";
import {
  register,
  login,
  getProfile,
  updateProfile,
  changePassword,
  uploadAvatar,
} from "../controllers/authController.js";
import { authenticateToken } from "../middlewares/authMiddleware.js";

const router = express.Router();

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png/;
  const extname = allowedTypes.test(
    path.extname(file.originalname).toLowerCase(),
  );
  const mimetype = allowedTypes.test(file.mimetype);

  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb(new Error("Hanya file gambar (JPG/PNG) yang diperbolehkan!"));
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: { fileSize: 2 * 1024 * 1024 },
});

router.post("/register", register);
router.post("/login", login);

router.use(authenticateToken);

router.get("/profile", getProfile);
router.put("/profile", updateProfile);
router.put("/profile/password", changePassword);

router.post("/profile/avatar", upload.single("avatar"), uploadAvatar);

export default router;
