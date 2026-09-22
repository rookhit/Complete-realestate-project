import { z } from "zod";

const email = z.string().trim().toLowerCase().pipe(z.email());

// bcrypt only reads the first 72 bytes of a password, so length is measured
// in UTF-8 bytes rather than characters (multi-byte characters would otherwise
// let a "72 character" password silently exceed bcrypt's limit).
const password = z.string().refine((value) => {
  const bytes = Buffer.byteLength(value, "utf8");
  return bytes >= 8 && bytes <= 72;
}, "Password must be 8 to 72 bytes long");

export const registerSchema = z.object({
  email,
  password,
  name: z.string().trim().min(1).max(255).optional(),
});

export const loginSchema = z.object({
  email,
  password,
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
