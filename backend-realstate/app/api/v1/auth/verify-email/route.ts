import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { signMfaToken } from "@/lib/auth/jwt";
import { verifyEmailCode } from "@/lib/auth/email-verification";
import { startSession } from "@/lib/auth/session";
import { assertUnderFailureLimit, recordRateLimitFailure } from "@/lib/auth/rate-limit";
import { logAuthEvent } from "@/lib/auth/audit";
import { HttpError, errorResponse, jsonResponse } from "@/lib/auth/guards";
import { preflightResponse } from "@/lib/http/cors";
import { readJsonBody } from "@/lib/http/body";
import { getRequestContext } from "@/lib/http/request-context";
import { verifyEmailSchema } from "@/lib/validation/auth";

export async function OPTIONS(request: Request): Promise<Response> {
  return preflightResponse(request);
}

// { email, code } → marks the email verified and signs the user in ({ user, accessToken } +
// refresh cookie), the same result as a successful login.
export async function POST(request: Request): Promise<NextResponse> {
  try {
    const context = getRequestContext(request);
    const { email, code } = await readJsonBody(request, verifyEmailSchema);
    await assertUnderFailureLimit("verify-email-failure", context.ip);

    let userId: string;
    try {
      ({ id: userId } = await verifyEmailCode(email, code));
    } catch (error) {
      // 400 wrong/expired code, 429 verification locked for this account (lib/auth/email-verification.ts).
      if (error instanceof HttpError && (error.status === 400 || error.status === 429)) {
        await recordRateLimitFailure("verify-email-failure", context.ip);
        await logAuthEvent("email_verification_failed", { context });
      }
      throw error;
    }
    await logAuthEvent("email_verified", { userId, context });

    const user = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { id: true, email: true, name: true, phone: true, role: true, totpEnabledAt: true },
    });
    // Not reachable today (2FA can only be turned on after signing in), but never skip it.
    if (user.totpEnabledAt) {
      return jsonResponse(request, { mfaRequired: true, mfaToken: await signMfaToken(user.id) });
    }

    const accessToken = await startSession(user, context, "login", { via: "email_verification" });
    return jsonResponse(request, {
      user: { id: user.id, email: user.email, name: user.name, phone: user.phone, role: user.role },
      accessToken,
    });
  } catch (error) {
    return errorResponse(request, error);
  }
}
