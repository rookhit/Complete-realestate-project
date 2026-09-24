import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { hashPassword } from "@/lib/auth/password";
import { signAccessToken } from "@/lib/auth/jwt";
import { createRefreshToken } from "@/lib/auth/refresh-token";
import { setRefreshCookie } from "@/lib/auth/cookies";
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

const USER_SELECT = {
  id: true,
  email: true,
  name: true,
  phone: true,
  role: true,
} as const;

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
    const passwordHash = await hashPassword(password);

    const user = await prisma.user
      .create({
        data: {
          email,
          passwordHash,
          name,
          phone,
          lastLoginAt: new Date(),
          lastLoginIp: context.ip,
        },
        select: USER_SELECT,
      })
      .catch((error: unknown) => {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
          throw new HttpError(409, "CONFLICT", "Email already registered");
        }
        throw error;
      });

    const accessToken = await signAccessToken({ sub: user.id, role: user.role });
    const { token: refreshToken } = await createRefreshToken(user.id, context);
    await setRefreshCookie(refreshToken);
    await logAuthEvent("register", { userId: user.id, context });

    return jsonResponse(request, { user, accessToken });
  } catch (error) {
    return errorResponse(request, error);
  }
}
