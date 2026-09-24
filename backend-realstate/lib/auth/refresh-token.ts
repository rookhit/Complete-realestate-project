import { randomBytes, createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { HttpError } from "@/lib/auth/guards";
import { logAuthEvent } from "@/lib/auth/audit";
import { isSameUserAgentFamily, type RequestContext } from "@/lib/http/request-context";
import type { Role } from "@/generated/prisma/client";

const REFRESH_TOKEN_BYTES = 32;
const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

// Two tabs (or a browser restoring several tabs) can send the same cookie to /refresh at the
// same moment; the loser sees a token rotated milliseconds ago. Inside this window that is a
// harmless race, not token theft: the loser gets a 409 and retries, because by then the
// browser already holds the winner's new cookie.
const REUSE_GRACE_MS = 30 * 1000;

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function invalidRefreshToken(): HttpError {
  return new HttpError(401, "UNAUTHENTICATED", "Invalid refresh token");
}

// Lost a race with a concurrent refresh of the same token. The route must NOT clear the
// cookie for this (that would delete the winner's new cookie and log the user out).
function refreshRaceLost(): HttpError {
  return new HttpError(409, "CONFLICT", "Session was just refreshed by another tab. Retry.", undefined, {
    "Retry-After": "1",
  });
}

export type IssuedRefreshToken = {
  token: string;
  expiresAt: Date;
};

export async function createRefreshToken(userId: string, context: RequestContext): Promise<IssuedRefreshToken> {
  const token = randomBytes(REFRESH_TOKEN_BYTES).toString("hex");
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);

  await prisma.refreshToken.create({
    data: {
      tokenHash: hashToken(token),
      userId,
      ipAddress: context.ip,
      userAgent: context.userAgent,
      expiresAt,
    },
  });

  return { token, expiresAt };
}

// Swaps a valid refresh token for a new one (the old row is revoked). Rejects with 401 when
// the token is unknown, expired, revoked, or presented by a different browser/OS than the
// one it was issued to. A token that was already rotated (outside the grace window) means a
// copy of it is in someone else's hands, so every session of that user is revoked.
export async function rotateRefreshToken(
  token: string,
  context: RequestContext,
): Promise<IssuedRefreshToken & { userId: string; role: Role }> {
  const existing = await prisma.refreshToken.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: { select: { role: true } } },
  });

  if (!existing) throw invalidRefreshToken();

  if (existing.revokedAt) {
    const reused = existing.rotatedAt && Date.now() - existing.rotatedAt.getTime() > REUSE_GRACE_MS;
    if (reused) {
      await revokeAllSessionsForUser(existing.userId);
      await logAuthEvent("refresh_token_reuse", { userId: existing.userId, context });
      throw invalidRefreshToken();
    }
    // Rotated moments ago by a concurrent request: a race. Revoked any other way (logout,
    // password reset, ...): simply invalid.
    throw existing.rotatedAt ? refreshRaceLost() : invalidRefreshToken();
  }

  if (existing.expiresAt < new Date()) throw invalidRefreshToken();

  if (!isSameUserAgentFamily(existing.userAgent, context.userAgent)) {
    await prisma.refreshToken.updateMany({
      where: { id: existing.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await logAuthEvent("refresh_user_agent_mismatch", {
      userId: existing.userId,
      context,
      metadata: { issuedToUserAgent: existing.userAgent },
    });
    throw invalidRefreshToken();
  }

  const newToken = randomBytes(REFRESH_TOKEN_BYTES).toString("hex");
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);

  await prisma.$transaction(async (tx) => {
    // Conditional update: if a concurrent request already rotated this token, count is 0
    // and only one of them gets a new token.
    const now = new Date();
    const { count } = await tx.refreshToken.updateMany({
      where: { id: existing.id, revokedAt: null },
      data: { revokedAt: now, rotatedAt: now },
    });
    if (count === 0) throw refreshRaceLost();

    await tx.refreshToken.create({
      data: {
        tokenHash: hashToken(newToken),
        userId: existing.userId,
        ipAddress: context.ip,
        userAgent: context.userAgent,
        expiresAt,
      },
    });
  });

  return { token: newToken, expiresAt, userId: existing.userId, role: existing.user.role };
}

// Revokes one token (logout). Returns the owner's id, or null if the token was unknown or
// already revoked.
export async function revokeRefreshToken(token: string): Promise<string | null> {
  const existing = await prisma.refreshToken.findUnique({
    where: { tokenHash: hashToken(token) },
    select: { id: true, userId: true },
  });
  if (!existing) return null;

  const { count } = await prisma.refreshToken.updateMany({
    where: { id: existing.id, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  return count > 0 ? existing.userId : null;
}

// Signs the user out everywhere: revokes every refresh token and marks every access token
// issued so far as stale (enforced by requireFreshAuth / requireAdmin).
export async function revokeAllSessionsForUser(userId: string): Promise<void> {
  const now = new Date();
  await prisma.$transaction([
    prisma.refreshToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: now } }),
    prisma.user.update({ where: { id: userId }, data: { sessionsRevokedAt: now } }),
  ]);
}
