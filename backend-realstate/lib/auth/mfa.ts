import { prisma } from "@/lib/prisma";
import { HttpError } from "@/lib/auth/guards";
import { verifyPassword } from "@/lib/auth/password";
import { hitCounter } from "@/lib/auth/rate-limit";
import {
  decryptTotpSecret,
  encryptTotpSecret,
  generateRecoveryCodes,
  generateTotpSecret,
  hashRecoveryCode,
  totpUri,
  verifyTotp,
} from "@/lib/auth/totp";

// Per-user cap on wrong 2FA codes, on top of the per-IP "mfa" rate limit: stops an attacker
// who has the password from spreading guesses across many IPs.
const MAX_FAILURES = 5;
const FAILURE_WINDOW_MS = 15 * 60 * 1000;

function failureKey(userId: string): string {
  return `mfa-fail:${userId}`;
}

async function assertNotMfaLocked(userId: string): Promise<void> {
  const row = await prisma.rateLimit.findUnique({ where: { key: failureKey(userId) } });
  if (!row || row.count < MAX_FAILURES) return;
  const retryMs = row.windowStart.getTime() + FAILURE_WINDOW_MS - Date.now();
  if (retryMs <= 0) return;
  throw new HttpError(429, "RATE_LIMITED", "Too many wrong codes. Please try again later.", undefined, {
    "Retry-After": String(Math.ceil(retryMs / 1000)),
  });
}

function invalidCode(): HttpError {
  return new HttpError(401, "UNAUTHENTICATED", "Invalid code");
}

// Re-authentication before changing 2FA, so a stolen access token alone can't turn 2FA on
// (locking the owner out) or off. Accounts without a password (Google-only) skip this.
// Wrong passwords count toward the same per-user limit as wrong codes.
export async function assertCurrentPassword(userId: string, password: string | undefined): Promise<void> {
  await assertNotMfaLocked(userId);
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { passwordHash: true } });
  if (!user.passwordHash) return;
  if (!password || !(await verifyPassword(password, user.passwordHash))) {
    await hitCounter(failureKey(userId), FAILURE_WINDOW_MS);
    throw new HttpError(401, "UNAUTHENTICATED", "Wrong password");
  }
}

export type SecondFactorResult = "totp" | "recovery_code";

// Checks a 6-digit authenticator code or a one-time recovery code for a user with 2FA on.
// Codes can't be replayed: a TOTP step is recorded, a recovery code is marked used.
export async function verifySecondFactor(userId: string, code: string): Promise<SecondFactorResult> {
  await assertNotMfaLocked(userId);

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { totpSecret: true, totpEnabledAt: true, totpLastUsedStep: true },
  });
  if (!user?.totpSecret || !user.totpEnabledAt) throw invalidCode();

  const trimmed = code.trim();
  if (/^\d{6}$/.test(trimmed)) {
    const step = verifyTotp(decryptTotpSecret(user.totpSecret, userId), trimmed, user.totpLastUsedStep);
    if (step !== null) {
      // Conditional update: two requests racing with the same code can't both win.
      const { count } = await prisma.user.updateMany({
        where: { id: userId, OR: [{ totpLastUsedStep: null }, { totpLastUsedStep: { lt: step } }] },
        data: { totpLastUsedStep: step },
      });
      if (count === 1) return "totp";
    }
  } else {
    const { count } = await prisma.mfaRecoveryCode.updateMany({
      where: { userId, codeHash: hashRecoveryCode(trimmed), usedAt: null },
      data: { usedAt: new Date() },
    });
    if (count === 1) return "recovery_code";
  }

  await hitCounter(failureKey(userId), FAILURE_WINDOW_MS);
  throw invalidCode();
}

// Step 1 of turning 2FA on: stores a new (not yet active) secret and returns what the user
// types or scans into their authenticator app.
export async function beginTotpSetup(userId: string): Promise<{ secret: string; otpauthUrl: string }> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { email: true, totpEnabledAt: true },
  });
  if (user.totpEnabledAt) {
    throw new HttpError(409, "CONFLICT", "Two-factor authentication is already on");
  }

  const secret = generateTotpSecret();
  await prisma.user.update({
    where: { id: userId },
    data: { totpSecret: encryptTotpSecret(secret, userId), totpLastUsedStep: null },
  });
  return { secret, otpauthUrl: totpUri(secret, user.email) };
}

// Step 2: the first code from the app proves it was set up correctly. Turns 2FA on, replaces
// any old recovery codes, and returns the new ones (the only time they are ever shown).
export async function completeTotpSetup(userId: string, code: string): Promise<string[]> {
  await assertNotMfaLocked(userId);
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { totpSecret: true, totpEnabledAt: true },
  });
  if (user.totpEnabledAt) {
    throw new HttpError(409, "CONFLICT", "Two-factor authentication is already on");
  }
  if (!user.totpSecret) {
    throw new HttpError(400, "VALIDATION_FAILED", "Start the setup first");
  }

  const step = verifyTotp(decryptTotpSecret(user.totpSecret, userId), code.trim(), null);
  if (step === null) {
    await hitCounter(failureKey(userId), FAILURE_WINDOW_MS);
    throw new HttpError(400, "VALIDATION_FAILED", "Invalid code. Check the time on your phone and try again.");
  }

  const recoveryCodes = generateRecoveryCodes();
  await prisma.$transaction([
    prisma.mfaRecoveryCode.deleteMany({ where: { userId } }),
    prisma.mfaRecoveryCode.createMany({
      data: recoveryCodes.map((c) => ({ userId, codeHash: hashRecoveryCode(c) })),
    }),
    prisma.user.update({
      where: { id: userId },
      data: { totpEnabledAt: new Date(), totpLastUsedStep: step },
    }),
  ]);
  return recoveryCodes;
}

export async function disableTotp(userId: string): Promise<void> {
  await prisma.$transaction([
    prisma.mfaRecoveryCode.deleteMany({ where: { userId } }),
    prisma.user.update({
      where: { id: userId },
      data: { totpSecret: null, totpEnabledAt: null, totpLastUsedStep: null },
    }),
  ]);
}
