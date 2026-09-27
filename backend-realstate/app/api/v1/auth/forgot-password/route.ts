import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { RESET_TOKEN_TTL_MINUTES, createPasswordResetToken } from "@/lib/auth/password-reset";
import { sendEmailAfterResponse } from "@/lib/email/send-later";
import { passwordResetEmail } from "@/lib/email/templates";
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
      const link = `${origin}/reset-password?token=${token}`;
      // Sent after the response, so answering for a real account takes as long as for an unknown one.
      sendEmailAfterResponse(passwordResetEmail(user.email, link, RESET_TOKEN_TTL_MINUTES));
      await logAuthEvent("password_reset_requested", { userId: user.id, context });
    }

    return noContentResponse(request);
  } catch (error) {
    return errorResponse(request, error);
  }
}
