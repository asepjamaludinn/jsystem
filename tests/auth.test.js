import { describe, it, expect, vi, beforeEach } from "vitest";
import { register } from "../src/controllers/authController.js";
import prisma from "../src/config/db.js";
import bcrypt from "bcryptjs";

vi.mock("../src/config/db.js", () => ({
  default: {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
  },
}));

vi.mock("bcryptjs", () => ({
  default: {
    hash: vi.fn(),
  },
}));

describe("Auth Controller - Register", () => {
  let req, res;

  beforeEach(() => {
    req = {
      body: {
        name: "Test User",
        email: "test@student.telkomuniversity",
        password: "password123",
      },
    };
    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };
    vi.clearAllMocks();
  });

  it("Harus sukses mendaftarkan user baru (Status 201)", async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    bcrypt.hash.mockResolvedValue("hashedPassword123");
    prisma.user.create.mockResolvedValue({
      id: "user-123",
      email: req.body.email,
    });

    await register(req, res);

    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { email: req.body.email },
    });
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({
      message: "Registrasi berhasil!",
      userId: "user-123",
    });
  });

  it("Harus menolak jika email sudah terdaftar (Status 400)", async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: "user-999",
      email: req.body.email,
    });

    await register(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "Email sudah terdaftar!" });

    expect(prisma.user.create).not.toHaveBeenCalled();
  });
});
