import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { hashPassword } from "@/lib/auth/password";
import { deleteExpiredUnverifiedUsers, sendVerificationCode } from "@/lib/auth/email-verification";
import {
  HttpError,
  errorResponse,
  jsonResponse,
  requireAllowedOrigin,
  requireJsonContentType,
} from "@/lib/auth/guards";
import { enforceRateLimit } from "@/lib/auth/rate-limit";
import { logAuthEvent } from "@/lib/auth/audit";
import { preflightResponse } from "@/lib/http/cors";
import { getRequestContext } from "@/lib/http/request-context";
import { registerSchema } from "@/lib/validation/auth";

export async function OPTIONS(request: Request): Promise<Response> {
  return preflightResponse(request);
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    requireJsonContentType(request);
    requireAllowedOrigin(request);

    const context = getRequestContext(request);
    await enforceRateLimit("register", context.ip);

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new HttpError(400, "VALIDATION_FAILED", "Invalid JSON body");
    }

    const parsed = registerSchema.safeParse(body);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      throw new HttpError(400, "VALIDATION_FAILED", issue?.message ?? "Invalid request body", {
        [String(issue?.path[0] ?? "body")]: issue?.message ?? "Invalid value",
      });
    }

    const { email, password, name, phone } = parsed.data;
    // Expired unverified sign-ups (including one for this email) are deleted first, so the email
    // can be registered again. Doing it here keeps them purged even while the cron job is off.
    await deleteExpiredUnverifiedUsers();
    const passwordHash = await hashPassword(password);

    const user = await prisma.user
      .create({
        data: {
          email,
          passwordHash,
          name,
          phone,
        },
        select: { id: true, email: true },
      })
      .catch((error: unknown) => {
        // Also for an existing account that never verified its email: its owner signs in (which
        // re-sends the code) or, if someone else registered it, resets the password (the reset
        // link proves the inbox and verifies the email).
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
          throw new HttpError(409, "CONFLICT", "This email is already registered. Sign in instead, or reset your password.");
        }
        throw error;
      });

    // No session yet: the account is unusable until the emailed code is entered
    // (POST /auth/verify-email), which then signs the user in.
    await sendVerificationCode(user);
    await logAuthEvent("register", { userId: user.id, context });
    await logAuthEvent("email_verification_sent", { userId: user.id, context, metadata: { via: "register" } });

    return jsonResponse(request, { verificationRequired: true, email: user.email });
  } catch (error) {
    return errorResponse(request, error);
  }
}
