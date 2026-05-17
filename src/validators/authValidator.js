import { z } from "zod";

export const registerSchema = z.object({
  body: z.object({
    name: z
      .string({ required_error: "Nama wajib diisi" })
      .min(3, "Nama minimal 3 karakter")
      .max(50, "Nama maksimal 50 karakter"),
    email: z
      .string({ required_error: "Email wajib diisi" })
      .email("Format email tidak valid"),
    password: z
      .string({ required_error: "Password wajib diisi" })
      .min(6, "Password minimal 6 karakter"),
  }),
});

export const loginSchema = z.object({
  body: z.object({
    email: z
      .string({ required_error: "Email wajib diisi" })
      .email("Format email tidak valid"),
    password: z
      .string({ required_error: "Password wajib diisi" })
      .min(1, "Password tidak boleh kosong"),
  }),
});

export const updateProfileSchema = z.object({
  body: z.object({
    name: z
      .string({ required_error: "Nama wajib diisi" })
      .min(3, "Nama minimal 3 karakter")
      .max(50, "Nama maksimal 50 karakter"),
  }),
});

export const changePasswordSchema = z.object({
  body: z
    .object({
      oldPassword: z
        .string({ required_error: "Password lama wajib diisi" })
        .min(1, "Password lama tidak boleh kosong"),
      newPassword: z
        .string({ required_error: "Password baru wajib diisi" })
        .min(6, "Password baru minimal 6 karakter"),
    })
    .refine((data) => data.oldPassword !== data.newPassword, {
      message: "Password baru tidak boleh sama dengan password lama!",
      path: ["newPassword"],
    }),
});
