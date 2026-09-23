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
import { preflightResponse } from "@/lib/http/cors";
import { forgotPasswordSchema } from "@/lib/validation/auth";

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

    const parsed = forgotPasswordSchema.safeParse(body);
    if (!parsed.success) {
      throw new HttpError(400, "VALIDATION_FAILED", parsed.error.issues[0]?.message ?? "Invalid request body");
    }

    const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
    if (user) {
      const token = await createPasswordResetToken(user.id);
      const origin = process.env.FRONTEND_ORIGIN ?? "http://localhost:5173";
      // Stub: no email provider is configured yet, so the reset link is logged
      // instead of sent. Swap this for a real provider call when one is chosen.
      console.log(`Password reset link for ${user.email}: ${origin}/reset-password?token=${token}`);
    }

    return noContentResponse(request);
  } catch (error) {
    return errorResponse(request, error);
  }
}
