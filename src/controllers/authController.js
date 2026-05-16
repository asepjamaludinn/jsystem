import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import prisma from "../config/db.js";
import path from "path";
import { supabase } from "../config/supabase.js";

export const register = async (req, res) => {
  try {
    const { email, password, name } = req.body;

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ error: "Email sudah terdaftar!" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = await prisma.user.create({
      data: { email, name, password: hashedPassword },
    });

    res
      .status(201)
      .json({ message: "Registrasi berhasil!", userId: newUser.id });
  } catch (error) {
    res.status(500).json({ error: "Terjadi kesalahan server" });
  }
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(401).json({ error: "Email atau password salah!" });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ error: "Email atau password salah!" });
    }

    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, {
      expiresIn: "1d",
    });

    res.json({ message: "Login sukses!", token, name: user.name });
  } catch (error) {
    res.status(500).json({ error: "Terjadi kesalahan server" });
  }
};

export const getProfile = async (req, res) => {
  try {
    const userId = req.user.userId;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        avatarUrl: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: "User tidak ditemukan!" });
    }

    res.json(user);
  } catch (error) {
    res.status(500).json({ error: "Gagal mengambil data profil." });
  }
};

export const updateProfile = async (req, res) => {
  try {
    const { name } = req.body;
    const userId = req.user.userId;

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { name },
    });

    res.json({
      message: "Profil berhasil diperbarui!",
      name: updatedUser.name,
    });
  } catch (error) {
    res.status(500).json({ error: "Gagal memperbarui profil." });
  }
};

export const changePassword = async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    const userId = req.user.userId;

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return res.status(404).json({ error: "User tidak ditemukan!" });
    }

    const isPasswordValid = await bcrypt.compare(oldPassword, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ error: "Password lama salah!" });
    }

    const hashedNewPassword = await bcrypt.hash(newPassword, 10);

    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedNewPassword },
    });

    res.json({ message: "Password berhasil diganti!" });
  } catch (error) {
    res.status(500).json({ error: "Gagal mengganti password." });
  }
};

export const uploadAvatar = async (req, res) => {
  try {
    const userId = req.user.userId;

    if (!req.file) {
      return res.status(400).json({ error: "Tidak ada file yang diunggah." });
    }

    const file = req.file;
    const fileExt = path.extname(file.originalname);

    const fileName = `avatar-${userId}-${Date.now()}${fileExt}`;

    const user = await prisma.user.findUnique({ where: { id: userId } });

    if (
      user.avatarUrl &&
      user.avatarUrl.includes("supabase.co/storage/v1/object/public/avatars/")
    ) {
      const oldFileName = user.avatarUrl.split("/").pop();
      if (oldFileName) {
        await supabase.storage.from("avatars").remove([oldFileName]);
      }
    }

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(fileName, file.buffer, {
        contentType: file.mimetype,
        upsert: true,
      });

    if (uploadError) {
      throw uploadError;
    }

    const { data: publicUrlData } = supabase.storage
      .from("avatars")
      .getPublicUrl(fileName);

    const newAvatarUrl = publicUrlData.publicUrl;

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { avatarUrl: newAvatarUrl },
    });

    res.json({
      message: "Foto profil berhasil diperbarui!",
      avatarUrl: updatedUser.avatarUrl,
    });
  } catch (error) {
    console.error("Gagal upload avatar ke Supabase:", error);
    res.status(500).json({ error: "Gagal memproses unggahan foto profil." });
  }
};
