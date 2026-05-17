import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import prisma from "../config/db.js";
import { uploadAvatarToSupabase } from "../services/storageService.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const register = asyncHandler(async (req, res) => {
  const { email, password, name } = req.body;

  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    return res.status(400).json({
      success: false,
      error: "Email sudah terdaftar!",
    });
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const newUser = await prisma.user.create({
    data: { email, name, password: hashedPassword },
  });

  res.status(201).json({
    success: true,
    message: "Registrasi berhasil!",
    data: { userId: newUser.id },
  });
});

export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return res.status(401).json({
      success: false,
      error: "Email atau password salah!",
    });
  }

  const isPasswordValid = await bcrypt.compare(password, user.password);
  if (!isPasswordValid) {
    return res.status(401).json({
      success: false,
      error: "Email atau password salah!",
    });
  }

  const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, {
    expiresIn: "1d",
  });

  res.json({
    success: true,
    message: "Login sukses!",
    data: { token, name: user.name },
  });
});

export const getProfile = asyncHandler(async (req, res) => {
  const userId = req.user.userId;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true, avatarUrl: true },
  });

  if (!user) {
    return res.status(404).json({
      success: false,
      error: "User tidak ditemukan!",
    });
  }

  res.json({
    success: true,
    message: "Profil berhasil diambil!",
    data: user,
  });
});

export const updateProfile = asyncHandler(async (req, res) => {
  const { name } = req.body;
  const userId = req.user.userId;

  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: { name },
  });

  res.json({
    success: true,
    message: "Profil berhasil diperbarui!",
    data: { name: updatedUser.name },
  });
});

export const changePassword = asyncHandler(async (req, res) => {
  const { oldPassword, newPassword } = req.body;
  const userId = req.user.userId;

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    return res.status(404).json({
      success: false,
      error: "User tidak ditemukan!",
    });
  }

  const isPasswordValid = await bcrypt.compare(oldPassword, user.password);
  if (!isPasswordValid) {
    return res.status(401).json({
      success: false,
      error: "Password lama salah!",
    });
  }

  const hashedNewPassword = await bcrypt.hash(newPassword, 10);

  await prisma.user.update({
    where: { id: userId },
    data: { password: hashedNewPassword },
  });

  res.json({
    success: true,
    message: "Password berhasil diganti!",
  });
});

export const uploadAvatar = asyncHandler(async (req, res) => {
  const userId = req.user.userId;

  if (!req.file) {
    return res.status(400).json({
      success: false,
      error: "Tidak ada file yang diunggah.",
    });
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    return res.status(404).json({
      success: false,
      error: "User tidak ditemukan!",
    });
  }

  const newAvatarUrl = await uploadAvatarToSupabase(
    req.file,
    userId,
    user.avatarUrl,
  );

  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: { avatarUrl: newAvatarUrl },
  });

  res.json({
    success: true,
    message: "Foto profil berhasil diperbarui!",
    data: { avatarUrl: updatedUser.avatarUrl },
  });
});
