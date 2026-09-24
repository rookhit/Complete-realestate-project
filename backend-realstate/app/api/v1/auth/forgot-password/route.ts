import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createPasswordResetToken } from "@/lib/auth/password-reset";
import {
  HttpError,
  errorResponse,
  noContentResponse,
  requireAllowedOrigin,
  requireJsonContentType,
} from "@/lib/auth/guards";
import { enforceRateLimit } from "@/lib/auth/rate-limit";
import { logAuthEvent } from "@/lib/auth/audit";
import { preflightResponse } from "@/lib/http/cors";
import { getRequestContext } from "@/lib/http/request-context";
import { forgotPasswordSchema } from "@/lib/validation/auth";

export async function OPTIONS(request: Request): Promise<Response> {
  return preflightResponse(request);
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    requireJsonContentType(request);
    requireAllowedOrigin(request);

    const context = getRequestContext(request);
    await enforceRateLimit("forgot-password", context.ip);

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new HttpError(400, "VALIDATION_FAILED", "Invalid JSON body");
    }

    const parsed = forgotPasswordSchema.safeParse(body);
    if (!parsed.success) {
      throw new HttpError(400, "VALIDATION_FAILED", parsed.error.issues[0]?.message ?? "Invalid request body");
    }

    const user = await prisma.user.findUnique({
      where: { email: parsed.data.email },
      select: { id: true, email: true },
    });
    if (user) {
      const token = await createPasswordResetToken(user.id);
      const origin = process.env.FRONTEND_ORIGIN ?? "http://localhost:5173";
      // Stub: no email provider is configured yet (email OTP is planned). The link is only
      // logged in development: in production anyone who can read the logs could use it.
      if (process.env.NODE_ENV !== "production") {
        console.log(`Password reset link for ${user.email}: ${origin}/reset-password?token=${token}`);
      }
      await logAuthEvent("password_reset_requested", { userId: user.id, context });
    }

    return noContentResponse(request);
  } catch (error) {
    return errorResponse(request, error);
  }
}
