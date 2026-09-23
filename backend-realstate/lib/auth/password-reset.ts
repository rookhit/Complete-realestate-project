import { randomBytes, createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { HttpError } from "@/lib/auth/guards";

const RESET_TOKEN_BYTES = 32;
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function createPasswordResetToken(userId: string): Promise<string> {
  const token = randomBytes(RESET_TOKEN_BYTES).toString("hex");
  const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);

  await prisma.passwordResetToken.create({
    data: { tokenHash: hashToken(token), userId, expiresAt },
  });

  return token;
}

export async function consumePasswordResetToken(token: string): Promise<string> {
  const existing = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hashToken(token) },
  });

  if (!existing || existing.usedAt || existing.expiresAt < new Date()) {
    throw new HttpError(400, "VALIDATION_FAILED", "Invalid or expired reset token");
  }

  await prisma.passwordResetToken.update({
    where: { id: existing.id },
    data: { usedAt: new Date() },
  });

  return existing.userId;
}
