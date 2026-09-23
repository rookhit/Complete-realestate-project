import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/auth/password";
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
import { preflightResponse } from "@/lib/http/cors";
import { loginSchema } from "@/lib/validation/auth";

const USER_SELECT = {
  id: true,
  email: true,
  name: true,
  phone: true,
  role: true,
  accountType: true,
  agencyName: true,
  licenseNumber: true,
  verificationStatus: true,
  passwordHash: true,
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
    const found = await prisma.user.findUnique({ where: { email }, select: USER_SELECT });

    const passwordValid = await verifyPassword(password, found?.passwordHash ?? DUMMY_PASSWORD_HASH);
    if (!found || !passwordValid) {
      throw new HttpError(401, "UNAUTHENTICATED", "Invalid email or password");
    }

    const accessToken = await signAccessToken({ sub: found.id, role: found.role });
    const { token: refreshToken } = await createRefreshToken(found.id);
    await setRefreshCookie(refreshToken);

    const user = {
      id: found.id,
      email: found.email,
      name: found.name,
      phone: found.phone,
      role: found.role,
      accountType: found.accountType,
      agencyName: found.agencyName,
      licenseNumber: found.licenseNumber,
      verificationStatus: found.verificationStatus,
    };
    return jsonResponse(request, { user, accessToken });
  } catch (error) {
    return errorResponse(request, error);
  }
}
