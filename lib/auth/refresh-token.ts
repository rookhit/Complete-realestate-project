import { randomBytes, createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { HttpError } from "@/lib/auth/guards";
import type { Role } from "@/generated/prisma/client";

const REFRESH_TOKEN_BYTES = 32;
const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export type IssuedRefreshToken = {
  token: string;
  expiresAt: Date;
};

export async function createRefreshToken(userId: string): Promise<IssuedRefreshToken> {
  const token = randomBytes(REFRESH_TOKEN_BYTES).toString("hex");
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);

  await prisma.refreshToken.create({
    data: {
      tokenHash: hashToken(token),
      userId,
      expiresAt,
    },
  });

  return { token, expiresAt };
}

export async function rotateRefreshToken(
  token: string,
): Promise<IssuedRefreshToken & { userId: string; role: Role }> {
  const existing = await prisma.refreshToken.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: { select: { role: true } } },
  });

  if (!existing || existing.revokedAt || existing.expiresAt < new Date()) {
    throw new HttpError(401, "Invalid refresh token");
  }

  const newToken = randomBytes(REFRESH_TOKEN_BYTES).toString("hex");
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);

  await prisma.$transaction([
    prisma.refreshToken.update({
      where: { id: existing.id },
      data: { revokedAt: new Date() },
    }),
    prisma.refreshToken.create({
      data: {
        tokenHash: hashToken(newToken),
        userId: existing.userId,
        expiresAt,
      },
    }),
  ]);

  return { token: newToken, expiresAt, userId: existing.userId, role: existing.user.role };
}

export async function revokeRefreshToken(token: string): Promise<void> {
  await prisma.refreshToken.updateMany({
    where: { tokenHash: hashToken(token), revokedAt: null },
    data: { revokedAt: new Date() },
  });
}
