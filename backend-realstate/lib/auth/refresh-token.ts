import { randomBytes, createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { HttpError } from "@/lib/auth/guards";
import { logAuthEvent } from "@/lib/auth/audit";
import { isSameUserAgentFamily, type RequestContext } from "@/lib/http/request-context";
import type { Role } from "@/generated/prisma/client";

const REFRESH_TOKEN_BYTES = 32;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * How long a sign-in lasts. `idle`: unused for this long, the session ends (every visit renews it,
 * since the 15-minute access token is refreshed while the site is open). `absolute`: it ends this long
 * after signing in however busy it is (OWASP: every session needs an absolute limit). Admins hold the
 * keys to the whole site, so theirs is short: sign in again at least every 3 days.
 */
export const SESSION_LIMITS: Record<Role, { idleMs: number; absoluteMs: number }> = {
  ADMIN: { idleMs: 1 * DAY_MS, absoluteMs: 3 * DAY_MS },
  USER: { idleMs: 7 * DAY_MS, absoluteMs: 30 * DAY_MS },
};

/** A token's expiry: renewed by use, but never past the session's absolute limit. */
function expiryFor(role: Role, sessionStartedAt: Date, now = Date.now()): Date {
  const { idleMs, absoluteMs } = SESSION_LIMITS[role];
  return new Date(Math.min(now + idleMs, sessionStartedAt.getTime() + absoluteMs));
}

// Two tabs (or a browser restoring several tabs) can send the same cookie to /refresh at the
// same moment; the loser sees a token rotated milliseconds ago. A reload can also abort a
// refresh after the server rotated the token but before the browser stored the new cookie,
// leaving it with the old one. Inside this window neither is token theft: while the old
// token's successor is still unused it may be exchanged again (see rotateRefreshToken).
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

/**
 * A new refresh token. Without `sessionStartedAt` it starts a new session (a sign-in); with it, the
 * token continues that session (the reuse-grace re-grant) and keeps its absolute limit.
 */
export async function createRefreshToken(userId: string, context: RequestContext, sessionStartedAt = new Date()): Promise<IssuedRefreshToken> {
  const token = randomBytes(REFRESH_TOKEN_BYTES).toString("hex");
  const { role } = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { role: true } });
  const expiresAt = expiryFor(role, sessionStartedAt);

  await prisma.refreshToken.create({
    data: {
      tokenHash: hashToken(token),
      userId,
      ipAddress: context.ip,
      userAgent: context.userAgent,
      expiresAt,
      sessionStartedAt,
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
    // Revoked any other way (logout, password reset, ...): simply invalid.
    if (!existing.rotatedAt) throw invalidRefreshToken();
    if (Date.now() - existing.rotatedAt.getTime() > REUSE_GRACE_MS) {
      await revokeAllSessionsForUser(existing.userId);
      await logAuthEvent("refresh_token_reuse", { userId: existing.userId, context });
      throw invalidRefreshToken();
    }
    // Rotated moments ago. Its successor is the token created at that same instant. Still
    // unused: either the browser never stored it (a reload aborted the response) or a
    // concurrent request's cookie is still on its way, so issue another one alongside it.
    // The successor is not revoked: in a race its cookie may land after this one.
    const successor = await prisma.refreshToken.findFirst({
      where: { userId: existing.userId, createdAt: existing.rotatedAt },
      select: { revokedAt: true, rotatedAt: true },
    });
    if (!successor) throw refreshRaceLost(); // rotated before successors were findable
    if (successor.rotatedAt) throw refreshRaceLost(); // used: the browser holds a newer cookie
    if (successor.revokedAt) throw invalidRefreshToken(); // logged out since
    if (!isSameUserAgentFamily(existing.userAgent, context.userAgent)) throw invalidRefreshToken();
    const issued = await createRefreshToken(existing.userId, context, existing.sessionStartedAt);
    await logAuthEvent("refresh_token_regrant", { userId: existing.userId, context });
    return { ...issued, userId: existing.userId, role: existing.user.role };
  }

  // Also ends a session at its absolute limit: no token is ever issued past it (expiryFor).
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
  // Same session: same start, so the absolute limit carries over; the role decides the limits.
  const expiresAt = expiryFor(existing.user.role, existing.sessionStartedAt);
  if (expiresAt.getTime() <= Date.now()) throw invalidRefreshToken();

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
        sessionStartedAt: existing.sessionStartedAt,
        // Same instant as the old token's rotatedAt: that is how a re-sent old token finds it.
        createdAt: now,
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
