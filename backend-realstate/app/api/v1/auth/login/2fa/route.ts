import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyMfaToken } from "@/lib/auth/jwt";
import { verifySecondFactor } from "@/lib/auth/mfa";
import { startSession } from "@/lib/auth/session";
import { assertUnderFailureLimit, recordRateLimitFailure } from "@/lib/auth/rate-limit";
import { logAuthEvent } from "@/lib/auth/audit";
import { clearMfaPendingCookie, getMfaPendingCookie } from "@/lib/auth/cookies";
import { HttpError, errorResponse, jsonResponse } from "@/lib/auth/guards";
import { preflightResponse } from "@/lib/http/cors";
import { readJsonBody } from "@/lib/http/body";
import { getRequestContext } from "@/lib/http/request-context";
import { mfaLoginSchema } from "@/lib/validation/auth";

export async function OPTIONS(request: Request): Promise<Response> {
  return preflightResponse(request);
}

// Second step of login for accounts with 2FA: { mfaToken (from /auth/login), code }.
// After Google sign-in the mfaToken comes from the mfa_pending cookie instead.
export async function POST(request: Request): Promise<NextResponse> {
  try {
    const context = getRequestContext(request);
    const { mfaToken, code } = await readJsonBody(request, mfaLoginSchema);
    await assertUnderFailureLimit("mfa-failure", context.ip);

    const pending = mfaToken ?? (await getMfaPendingCookie());
    const userId = pending ? await verifyMfaToken(pending) : null;
    if (!userId) {
      await recordRateLimitFailure("mfa-failure", context.ip);
      throw new HttpError(401, "UNAUTHENTICATED", "Your sign-in expired. Please enter your password again.");
    }

    let method;
    try {
      method = await verifySecondFactor(userId, code);
    } catch (error) {
      if (error instanceof HttpError && error.status === 401) {
        await recordRateLimitFailure("mfa-failure", context.ip);
        await logAuthEvent("mfa_failed", { userId, context });
      }
      throw error;
    }

    const user = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { id: true, email: true, name: true, phone: true, role: true },
    });
    const accessToken = await startSession(user, context, "login", { mfa: method });
    await clearMfaPendingCookie();
    return jsonResponse(request, { user, accessToken });
  } catch (error) {
    return errorResponse(request, error);
  }
}
