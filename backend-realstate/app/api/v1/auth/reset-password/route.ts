import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth/password";
import { consumePasswordResetToken } from "@/lib/auth/password-reset";
import { revokeAllRefreshTokensForUser } from "@/lib/auth/refresh-token";
import {
  HttpError,
  errorResponse,
  noContentResponse,
  requireAllowedOrigin,
  requireJsonContentType,
} from "@/lib/auth/guards";
import { preflightResponse } from "@/lib/http/cors";
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

    const userId = await consumePasswordResetToken(parsed.data.token);
    const passwordHash = await hashPassword(parsed.data.password);

    await prisma.user.update({ where: { id: userId }, data: { passwordHash } });
    await revokeAllRefreshTokensForUser(userId);

    return noContentResponse(request);
  } catch (error) {
    return errorResponse(request, error);
  }
}
