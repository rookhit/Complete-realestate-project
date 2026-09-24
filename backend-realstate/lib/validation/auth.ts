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
  })
  .superRefine((data, ctx) => {
    if (data.password !== data.confirmPassword) {
      ctx.addIssue({
        code: "custom",
        path: ["confirmPassword"],
        message: "Passwords do not match",
      });
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

export const verifyResetTokenSchema = z.object({
  token: z.string().min(1),
});

export const mfaLoginSchema = z.object({
  // From the /auth/login response; omitted after Google sign-in (it's in a cookie then).
  mfaToken: z.string().min(1).optional(),
  // 6-digit authenticator code or a recovery code (XXXX-XXXX).
  code: z.string().trim().min(6).max(20),
});

// Current password, required when the account has one (Google-only accounts don't).
export const totpSetupSchema = z.object({
  password: z.string().max(200).optional(),
});

export const totpEnableSchema = z.object({
  code: z.string().trim().regex(/^\d{6}$/, "Enter the 6-digit code from your app"),
});

export const totpDisableSchema = z.object({
  password: z.string().max(200).optional(),
  code: z.string().trim().min(6).max(20),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
