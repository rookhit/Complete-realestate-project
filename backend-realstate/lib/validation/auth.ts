import { z } from "zod";

const email = z.string().trim().toLowerCase().pipe(z.email());

// bcrypt only reads the first 72 bytes of a password, so length is measured
// in UTF-8 bytes rather than characters (multi-byte characters would otherwise
// let a "72 character" password silently exceed bcrypt's limit).
const password = z.string().refine((value) => {
  const bytes = Buffer.byteLength(value, "utf8");
  return bytes >= 8 && bytes <= 72;
}, "Password must be 8 to 72 bytes long");

const phone = z
  .string()
  .trim()
  .regex(/^(?:\+977[- ]?)?9\d{9}$/, "Enter a valid Nepal phone number");

export const registerSchema = z
  .object({
    email,
    password,
    confirmPassword: z.string(),
    name: z.string().trim().min(1).max(255),
    phone,
    type: z.enum(["member", "agency", "agent"]).default("member"),
    agencyName: z.string().trim().min(1).max(255).optional(),
    licenseNumber: z.string().trim().min(1).max(100).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.password !== data.confirmPassword) {
      ctx.addIssue({
        code: "custom",
        path: ["confirmPassword"],
        message: "Passwords do not match",
      });
    }

    if (data.type === "agency") {
      if (!data.agencyName) {
        ctx.addIssue({ code: "custom", path: ["agencyName"], message: "Agency name is required" });
      }
      if (!data.licenseNumber) {
        ctx.addIssue({ code: "custom", path: ["licenseNumber"], message: "License number is required" });
      }
    }

    if (data.type === "agent" && !data.licenseNumber) {
      ctx.addIssue({ code: "custom", path: ["licenseNumber"], message: "License number is required" });
    }
  });

export const loginSchema = z.object({
  email,
  password,
});

export const forgotPasswordSchema = z.object({
  email,
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password,
});

export const verificationStatusSchema = z.object({
  status: z.enum(["APPROVED", "REJECTED"]),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
