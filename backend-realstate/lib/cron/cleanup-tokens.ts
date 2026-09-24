import { prisma } from "@/lib/prisma";

const DAY_MS = 24 * 60 * 60 * 1000;

// Rows kept a while after they stop being usable, so reuse detection and investigations
// still have something to look at.
const REFRESH_TOKEN_RETENTION_MS = 30 * DAY_MS;
const RESET_TOKEN_RETENTION_MS = 1 * DAY_MS;
const RATE_LIMIT_RETENTION_MS = 1 * DAY_MS;
const AUDIT_LOG_RETENTION_MS = 180 * DAY_MS;

export type CleanupResult = {
  refreshTokens: number;
  passwordResetTokens: number;
  rateLimits: number;
  loginLockouts: number;
  auditLogs: number;
};

// Deletes auth rows that can never be used again. Safe to run as often as you like.
export async function cleanupExpiredTokens(): Promise<CleanupResult> {
  const now = Date.now();
  const refreshCutoff = new Date(now - REFRESH_TOKEN_RETENTION_MS);
  const resetCutoff = new Date(now - RESET_TOKEN_RETENTION_MS);

  const dayAgo = new Date(now - DAY_MS);
  const [refreshTokens, passwordResetTokens, rateLimits, loginLockouts, auditLogs] = await Promise.all([
    prisma.refreshToken.deleteMany({
      where: { OR: [{ expiresAt: { lt: refreshCutoff } }, { revokedAt: { lt: refreshCutoff } }] },
    }),
    prisma.passwordResetToken.deleteMany({
      where: { OR: [{ expiresAt: { lt: resetCutoff } }, { usedAt: { lt: resetCutoff } }] },
    }),
    prisma.rateLimit.deleteMany({ where: { windowStart: { lt: new Date(now - RATE_LIMIT_RETENTION_MS) } } }),
    // Idle for a day and not currently locked.
    prisma.loginLockout.deleteMany({
      where: { updatedAt: { lt: dayAgo }, OR: [{ lockedUntil: null }, { lockedUntil: { lt: new Date(now) } }] },
    }),
    prisma.auditLog.deleteMany({ where: { createdAt: { lt: new Date(now - AUDIT_LOG_RETENTION_MS) } } }),
  ]);

  return {
    refreshTokens: refreshTokens.count,
    passwordResetTokens: passwordResetTokens.count,
    rateLimits: rateLimits.count,
    loginLockouts: loginLockouts.count,
    auditLogs: auditLogs.count,
  };
}
