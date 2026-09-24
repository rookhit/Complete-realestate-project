import { randomBytes, createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { HttpError } from "@/lib/auth/guards";

const RESET_TOKEN_BYTES = 32;
const RESET_TOKEN_TTL_MS = 15 * 60 * 1000;

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

// Read-only check for the reset page: is this link still usable? Does not consume it.
export async function isPasswordResetTokenValid(token: string): Promise<boolean> {
  const existing = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hashToken(token) },
    select: { usedAt: true, expiresAt: true },
  });
  return Boolean(existing && !existing.usedAt && existing.expiresAt > new Date());
}

// Uses the token and sets the new password in one transaction: the token is marked used
// (a conditional update, so two concurrent submits can't both succeed), every other unused
// reset token of the user is invalidated, the password is set, and every session of the user
// is revoked (refresh tokens + access tokens via sessionsRevokedAt). Returns the user's id and
// email (so the caller can clear login lockouts).
export async function resetPasswordWithToken(
  token: string,
  passwordHash: string,
): Promise<{ userId: string; email: string }> {
  const tokenHash = hashToken(token);

  return prisma.$transaction(async (tx) => {
    const existing = await tx.passwordResetToken.findUnique({
      where: { tokenHash },
      select: { userId: true, user: { select: { email: true } } },
    });

    const now = new Date();
    const { count } = await tx.passwordResetToken.updateMany({
      where: { tokenHash, usedAt: null, expiresAt: { gt: now } },
      data: { usedAt: now },
    });
    if (!existing || count === 0) {
      throw new HttpError(400, "VALIDATION_FAILED", "Invalid or expired reset token");
    }

    // Any other reset link still sitting in the user's inbox dies with this reset.
    await tx.passwordResetToken.updateMany({
      where: { userId: existing.userId, usedAt: null },
      data: { usedAt: now },
    });
    await tx.user.update({
      where: { id: existing.userId },
      data: { passwordHash, sessionsRevokedAt: now },
    });
    await tx.refreshToken.updateMany({
      where: { userId: existing.userId, revokedAt: null },
      data: { revokedAt: now },
    });

    return { userId: existing.userId, email: existing.user.email };
  });
}
