import { prisma } from "@/lib/prisma";
import { HttpError } from "@/lib/auth/guards";

// Per-IP fixed-window limits, stored in the RateLimit table (no Redis needed).
// These sit in front of the per-(IP, email) lockout in login-lockout.ts: the lockout stops
// guessing one account's password, these stop one client hammering many accounts or
// spamming sign-ups / reset emails.
//
// Sized for shared IPs: many people in Nepal reach the internet through one public IP
// (mobile carrier NAT, offices, cybercafés), so the limits must not trip on ordinary use.
// Login and 2FA therefore count only FAILED attempts (successful logins never add up);
// register and forgot-password count every request, with room for a busy shared IP.
const LIMITS = {
  "login-failure": { max: 30, windowMs: 15 * 60 * 1000 },
  // 2FA code guessing; a 6-digit code has 1,000,000 values (plus a per-user cap in mfa.ts).
  "mfa-failure": { max: 20, windowMs: 15 * 60 * 1000 },
  register: { max: 20, windowMs: 60 * 60 * 1000 },
  "forgot-password": { max: 10, windowMs: 60 * 60 * 1000 },
} as const;

export type RateLimitedAction = keyof typeof LIMITS;

// Adds one to the fixed-window counter stored under `key` and returns the new count plus when
// the window started. A single upsert, so concurrent requests can't slip past the counter.
export async function hitCounter(key: string, windowMs: number): Promise<{ count: number; windowStart: Date }> {
  const now = new Date();
  const windowCutoff = new Date(now.getTime() - windowMs);

  const [row] = await prisma.$queryRaw<{ count: number; windowStart: Date }[]>`
    INSERT INTO "RateLimit" ("key", "count", "windowStart")
    VALUES (${key}, 1, ${now})
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE WHEN "RateLimit"."windowStart" <= ${windowCutoff} THEN 1 ELSE "RateLimit"."count" + 1 END,
      "windowStart" = CASE WHEN "RateLimit"."windowStart" <= ${windowCutoff} THEN ${now} ELSE "RateLimit"."windowStart" END
    RETURNING "count", "windowStart"`;

  return row ?? { count: 1, windowStart: now };
}

function limitError(windowStart: Date, windowMs: number): HttpError {
  const seconds = Math.max(1, Math.ceil((windowStart.getTime() + windowMs - Date.now()) / 1000));
  return new HttpError(429, "RATE_LIMITED", "Too many requests. Please try again later.", undefined, {
    "Retry-After": String(seconds),
  });
}

// Counts this request and throws 429 (with Retry-After) once the window's limit is exceeded.
// For actions where every request counts (register, forgot-password).
export async function enforceRateLimit(action: RateLimitedAction, ip: string): Promise<void> {
  const { max, windowMs } = LIMITS[action];
  const { count, windowStart } = await hitCounter(`${action}:${ip}`, windowMs);
  if (count > max) throw limitError(windowStart, windowMs);
}

// Read-only: throws 429 if this IP has already used up its allowance of failures. Pair with
// recordRateLimitFailure() for actions where only failures count (login, 2FA).
export async function assertUnderFailureLimit(action: RateLimitedAction, ip: string): Promise<void> {
  const { max, windowMs } = LIMITS[action];
  const row = await prisma.rateLimit.findUnique({ where: { key: `${action}:${ip}` } });
  if (row && row.count >= max && row.windowStart.getTime() + windowMs > Date.now()) {
    throw limitError(row.windowStart, windowMs);
  }
}

export async function recordRateLimitFailure(action: RateLimitedAction, ip: string): Promise<void> {
  await hitCounter(`${action}:${ip}`, LIMITS[action].windowMs);
}
