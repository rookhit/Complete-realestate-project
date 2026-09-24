import { NextResponse } from "next/server";
import { hashPassword } from "@/lib/auth/password";
import { resetPasswordWithToken } from "@/lib/auth/password-reset";
import { clearRefreshCookie } from "@/lib/auth/cookies";
import { logAuthEvent } from "@/lib/auth/audit";
import { clearAllFailedLoginsForEmail } from "@/lib/auth/login-lockout";
import {
  HttpError,
  errorResponse,
  noContentResponse,
  requireAllowedOrigin,
  requireJsonContentType,
} from "@/lib/auth/guards";
import { preflightResponse } from "@/lib/http/cors";
import { getRequestContext } from "@/lib/http/request-context";
import { resetPasswordSchema } from "@/lib/validation/auth";

export async function OPTIONS(request: Request): Promise<Response> {
  return preflightResponse(request);
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    requireJsonContentType(request);
    requireAllowedOrigin(request);

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new HttpError(400, "VALIDATION_FAILED", "Invalid JSON body");
    }

    const parsed = resetPasswordSchema.safeParse(body);
    if (!parsed.success) {
      throw new HttpError(400, "VALIDATION_FAILED", parsed.error.issues[0]?.message ?? "Invalid request body");
    }

    // Hash first (slow, ~250 ms) so the database transaction stays short.
    const passwordHash = await hashPassword(parsed.data.password);
    const { userId, email } = await resetPasswordWithToken(parsed.data.token, passwordHash);
    await clearAllFailedLoginsForEmail(email);
    await clearRefreshCookie();
    await logAuthEvent("password_reset", { userId, context: getRequestContext(request) });

    return noContentResponse(request);
  } catch (error) {
    return errorResponse(request, error);
  }
}
