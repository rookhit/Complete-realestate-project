import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/auth/password";
import { signMfaToken } from "@/lib/auth/jwt";
import { startSession } from "@/lib/auth/session";
import {
  assertNotLocked,
  clearFailedLogins,
  isAccountUnderAttack,
  lockoutKey,
  recordFailedLogin,
} from "@/lib/auth/login-lockout";
import { assertUnderFailureLimit, recordRateLimitFailure } from "@/lib/auth/rate-limit";
import { logAuthEvent } from "@/lib/auth/audit";
import { getRequestContext } from "@/lib/http/request-context";
import {
  HttpError,
  errorResponse,
  jsonResponse,
  requireAllowedOrigin,
  requireJsonContentType,
} from "@/lib/auth/guards";
import { preflightResponse } from "@/lib/http/cors";
import { loginSchema } from "@/lib/validation/auth";

const USER_SELECT = {
  id: true,
  email: true,
  name: true,
  phone: true,
  role: true,
  passwordHash: true,
  totpEnabledAt: true,
} as const;

// A valid bcrypt hash with no matching password, compared against when the
// email is unknown so response time doesn't reveal whether the account exists.
const DUMMY_PASSWORD_HASH = "$2b$12$4XTeYDTXllGGKk.p4Ctumu4JbkZYfHkXNRYeh/DN/WONOnZMktVJy";

export async function OPTIONS(request: Request): Promise<Response> {
  return preflightResponse(request);
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    requireJsonContentType(request);
    requireAllowedOrigin(request);

    const context = getRequestContext(request);
    // Only failed logins count toward the per-IP limit (see rate-limit.ts).
    await assertUnderFailureLimit("login-failure", context.ip);

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new HttpError(400, "VALIDATION_FAILED", "Invalid JSON body");
    }

    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
      throw new HttpError(400, "VALIDATION_FAILED", parsed.error.issues[0]?.message ?? "Invalid request body");
    }

    const { email, password } = parsed.data;
    // Same lockout for known and unknown emails, so a 429 doesn't reveal which exist.
    const key = lockoutKey(context.ip, email);
    await assertNotLocked(key);

    const found = await prisma.user.findUnique({ where: { email }, select: USER_SELECT });
    const passwordValid = await verifyPassword(password, found?.passwordHash ?? DUMMY_PASSWORD_HASH);
    if (!found || !passwordValid) {
      await recordRateLimitFailure("login-failure", context.ip);
      await logAuthEvent("login_failed", {
        userId: found?.id,
        context,
        metadata: { reason: found ? "wrong_password" : "unknown_email" },
      });
      if (found && (await isAccountUnderAttack(found.id))) {
        await logAuthEvent("login_attack_suspected", { userId: found.id, context });
      }
      try {
        await recordFailedLogin(key);
      } catch (error) {
        await logAuthEvent("login_locked", { userId: found?.id, context });
        throw error;
      }
      throw new HttpError(401, "UNAUTHENTICATED", "Invalid email or password");
    }

    await clearFailedLogins(key);

    // Password is right but 2FA is on: no session yet, only a 5-minute token for
    // POST /auth/login/2fa.
    if (found.totpEnabledAt) {
      await logAuthEvent("mfa_challenge", { userId: found.id, context });
      return jsonResponse(request, { mfaRequired: true, mfaToken: await signMfaToken(found.id) });
    }

    const accessToken = await startSession(found, context, "login");
    const user = {
      id: found.id,
      email: found.email,
      name: found.name,
      phone: found.phone,
      role: found.role,
    };
    return jsonResponse(request, { user, accessToken });
  } catch (error) {
    return errorResponse(request, error);
  }
}
