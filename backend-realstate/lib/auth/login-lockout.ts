import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { HttpError } from "@/lib/auth/guards";
import { hitCounter } from "@/lib/auth/rate-limit";

// Wrong passwords are counted per (client IP, email), not per account:
// - an attacker's wrong guesses lock only the attacker's IP for that email, so they can't
//   lock the real user (or the admin) out of their own account;
// - unknown emails are counted exactly like real ones, so a 429 doesn't reveal that an
//   account exists.
// After MAX_FAILED_ATTEMPTS in a row the pair is locked for BASE_LOCK_MS; every further wrong
// password (once the lock has expired) doubles it: 15, 30, 60 min... capped at MAX_LOCK_MS.
// A successful login clears it; a password reset clears it for every IP.
const MAX_FAILED_ATTEMPTS = 5;
const BASE_LOCK_MS = 15 * 60 * 1000;
const MAX_LOCK_MS = 24 * 60 * 60 * 1000;

// Distributed guessing (many IPs, one account) is slowed by the per-IP rate limit and bcrypt;
// past this many failures per day on one account we only raise an audit alert, never lock.
const ACCOUNT_ALERT_THRESHOLD = 50;
const ACCOUNT_ALERT_WINDOW_MS = 24 * 60 * 60 * 1000;

function emailHash(email: string): string {
  return createHash("sha256").update(email).digest("hex");
}

export function lockoutKey(ip: string, email: string): string {
  return `${ip}:${emailHash(email)}`;
}

function lockDurationMs(failedCount: number): number {
  return Math.min(BASE_LOCK_MS * 2 ** (failedCount - MAX_FAILED_ATTEMPTS), MAX_LOCK_MS);
}

function lockedError(lockedUntil: Date): HttpError {
  const seconds = Math.max(1, Math.ceil((lockedUntil.getTime() - Date.now()) / 1000));
  const minutes = Math.ceil(seconds / 60);
  return new HttpError(
    429,
    "RATE_LIMITED",
    `Too many failed login attempts. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`,
    undefined,
    { "Retry-After": String(seconds) },
  );
}

// Throws while this IP is locked out for this email, before the password is even checked,
// so a lock can't be brute-forced (a correct password is rejected too until it ends).
export async function assertNotLocked(key: string): Promise<void> {
  const row = await prisma.loginLockout.findUnique({ where: { key }, select: { lockedUntil: true } });
  if (row?.lockedUntil && row.lockedUntil > new Date()) {
    throw lockedError(row.lockedUntil);
  }
}

// Records one wrong password. Throws the 429 if this attempt triggers a lock, otherwise returns.
export async function recordFailedLogin(key: string): Promise<void> {
  const { failedCount } = await prisma.loginLockout.upsert({
    where: { key },
    create: { key, failedCount: 1 },
    update: { failedCount: { increment: 1 } },
    select: { failedCount: true },
  });

  if (failedCount < MAX_FAILED_ATTEMPTS) return;

  const lockedUntil = new Date(Date.now() + lockDurationMs(failedCount));
  await prisma.loginLockout.update({ where: { key }, data: { lockedUntil } });
  throw lockedError(lockedUntil);
}

// Counts a failure against the account as a whole; true exactly once per window, when the
// alert threshold is crossed.
export async function isAccountUnderAttack(userId: string): Promise<boolean> {
  const { count } = await hitCounter(`login-fail-account:${userId}`, ACCOUNT_ALERT_WINDOW_MS);
  return count === ACCOUNT_ALERT_THRESHOLD;
}

export async function clearFailedLogins(key: string): Promise<void> {
  await prisma.loginLockout.deleteMany({ where: { key } });
}

// After a password reset the old failures (from any IP) no longer mean anything.
export async function clearAllFailedLoginsForEmail(email: string): Promise<void> {
  await prisma.loginLockout.deleteMany({ where: { key: { endsWith: `:${emailHash(email)}` } } });
}

// Called on every successful sign-in (password, 2FA or Google).
export async function recordSuccessfulLogin(userId: string, ip: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { lastLoginAt: new Date(), lastLoginIp: ip },
  });
}
