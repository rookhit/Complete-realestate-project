import { createHash, randomInt, timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { HttpError } from "@/lib/auth/guards";
import { sendEmailAfterResponse } from "@/lib/email/send-later";
import { verificationCodeEmail } from "@/lib/email/templates";

// 6-digit email verification codes. One active code per user (EmailVerificationCode.userId is
// unique): sending a new one replaces the old. Only a SHA-256 hash is stored. A code dies after
// CODE_TTL_MS or MAX_ATTEMPTS tries (right or wrong), whichever comes first; a new code can be
// sent at most once per RESEND_COOLDOWN_MS so the endpoints can't be used to spam an inbox.
// MAX_ATTEMPTS alone would still allow 5 guesses per resend (one a minute, forever: whoever
// registered the email knows its password, and every login re-sends a code), so wrong codes are
// also counted across resends: MAX_FAILURES of them lock the account's verification for LOCK_MS.
// The owner isn't stuck: a password reset link or Google sign-in also verifies the email.
export const CODE_TTL_MINUTES = 15;
const CODE_TTL_MS = CODE_TTL_MINUTES * 60 * 1000;
const MAX_ATTEMPTS = 5;
const RESEND_COOLDOWN_MS = 60 * 1000;
const MAX_FAILURES = 10;
const LOCK_MS = 24 * 60 * 60 * 1000;

const INVALID_CODE = "This code is invalid or has expired. Request a new one.";
const LOCKED =
  "Too many wrong codes. Try again in 24 hours, or use \"Forgot password\" to verify your email now.";

// Email+password accounts that never verify are deleted this long after sign-up, so abandoned
// sign-ups don't pile up and nobody can hold on to someone else's email address.
export const UNVERIFIED_ACCOUNT_TTL_DAYS = 7;
const UNVERIFIED_ACCOUNT_TTL_MS = UNVERIFIED_ACCOUNT_TTL_DAYS * 24 * 60 * 60 * 1000;

// Deletes expired unverified accounts: all of them, or just the one with `email`. Their codes,
// tokens and lockouts go with them (cascade); audit rows are kept with userId set to null.
// Never touches the ADMIN (seeded verified anyway). Returns how many were deleted.
export async function deleteExpiredUnverifiedUsers(email?: string): Promise<number> {
  const { count } = await prisma.user.deleteMany({
    where: {
      emailVerifiedAt: null,
      role: "USER",
      createdAt: { lt: new Date(Date.now() - UNVERIFIED_ACCOUNT_TTL_MS) },
      ...(email ? { email } : {}),
    },
  });
  return count;
}

function hashCode(userId: string, code: string): string {
  return createHash("sha256").update(`${userId}:${code}`).digest("hex");
}

// Counts a wrong code (atomic increment, so parallel guesses all count). The one that reaches
// MAX_FAILURES locks verification and kills the current code, then answers 429 instead of 400.
// updateMany throughout: the row may have just been deleted by a parallel correct submit.
async function recordWrongCode(userId: string, now: Date): Promise<void> {
  await prisma.emailVerificationCode.updateMany({ where: { userId }, data: { failures: { increment: 1 } } });
  const { count } = await prisma.emailVerificationCode.updateMany({
    where: { userId, failures: { gte: MAX_FAILURES }, lockedUntil: null },
    data: { lockedUntil: new Date(now.getTime() + LOCK_MS), expiresAt: now },
  });
  if (count) throw new HttpError(429, "RATE_LIMITED", LOCKED);
}

// Creates a new code and emails it after the response is sent. Returns false (and sends
// nothing) while the previous code is inside the resend cooldown (that code stays valid) or
// while verification is locked. Once a lock has run out, the failure count starts over.
export async function sendVerificationCode(user: { id: string; email: string }): Promise<boolean> {
  const existing = await prisma.emailVerificationCode.findUnique({
    where: { userId: user.id },
    select: { sentAt: true, lockedUntil: true },
  });
  if (existing?.lockedUntil && existing.lockedUntil.getTime() > Date.now()) return false;
  if (existing && existing.sentAt.getTime() + RESEND_COOLDOWN_MS > Date.now()) return false;

  const code = randomInt(0, 1_000_000).toString().padStart(6, "0");
  const data = {
    codeHash: hashCode(user.id, code),
    attempts: 0,
    expiresAt: new Date(Date.now() + CODE_TTL_MS),
    sentAt: new Date(),
    ...(existing?.lockedUntil ? { failures: 0, lockedUntil: null } : {}),
  };
  await prisma.emailVerificationCode.upsert({
    where: { userId: user.id },
    create: { userId: user.id, ...data },
    update: data,
  });
  sendEmailAfterResponse(verificationCodeEmail(user.email, code, CODE_TTL_MINUTES));
  return true;
}

// Checks the code and marks the email verified. Every try (right or wrong) uses up one of the
// code's MAX_ATTEMPTS first, as one conditional update, so parallel guesses can't exceed it.
// Unknown email, already verified, no code, expired, used up or wrong: all the same 400.
// Locked (too many wrong codes across resends): 429, including for the wrong code that locks it.
export async function verifyEmailCode(email: string, code: string): Promise<{ id: string }> {
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, emailVerifiedAt: true },
  });
  if (!user || user.emailVerifiedAt) throw new HttpError(400, "VALIDATION_FAILED", INVALID_CODE);

  const now = new Date();
  const lock = await prisma.emailVerificationCode.findUnique({
    where: { userId: user.id },
    select: { lockedUntil: true },
  });
  if (lock?.lockedUntil && lock.lockedUntil > now) throw new HttpError(429, "RATE_LIMITED", LOCKED);

  const { count } = await prisma.emailVerificationCode.updateMany({
    where: { userId: user.id, attempts: { lt: MAX_ATTEMPTS }, expiresAt: { gt: now } },
    data: { attempts: { increment: 1 } },
  });
  const row = count
    ? await prisma.emailVerificationCode.findUnique({ where: { userId: user.id }, select: { codeHash: true } })
    : null;
  const expected = row ? Buffer.from(row.codeHash, "hex") : null;
  const given = Buffer.from(hashCode(user.id, code), "hex");
  if (!expected || !timingSafeEqual(expected, given)) {
    if (expected) await recordWrongCode(user.id, now);
    throw new HttpError(400, "VALIDATION_FAILED", INVALID_CODE);
  }

  // Delete-then-verify in one transaction; the delete's count stops two correct submits racing.
  await prisma.$transaction(async (tx) => {
    const deleted = await tx.emailVerificationCode.deleteMany({ where: { userId: user.id } });
    if (deleted.count === 0) throw new HttpError(400, "VALIDATION_FAILED", INVALID_CODE);
    await tx.user.update({ where: { id: user.id }, data: { emailVerifiedAt: now } });
  });
  return { id: user.id };
}
