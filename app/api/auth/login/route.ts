import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/auth/password";
import { signAccessToken } from "@/lib/auth/jwt";
import { createRefreshToken } from "@/lib/auth/refresh-token";
import { setAuthCookies } from "@/lib/auth/cookies";
import { HttpError, errorResponse, requireAllowedOrigin, requireJsonContentType } from "@/lib/auth/guards";
import { loginSchema } from "@/lib/validation/auth";

const USER_SELECT = { id: true, email: true, name: true, role: true, passwordHash: true } as const;

// A valid bcrypt hash with no matching password, compared against when the
// email is unknown so response time doesn't reveal whether the account exists.
const DUMMY_PASSWORD_HASH = "$2b$12$4XTeYDTXllGGKk.p4Ctumu4JbkZYfHkXNRYeh/DN/WONOnZMktVJy";

export async function POST(request: Request): Promise<NextResponse> {
  try {
    requireJsonContentType(request);
    requireAllowedOrigin(request);

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new HttpError(400, "Invalid JSON body");
    }

    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
      throw new HttpError(400, parsed.error.issues[0]?.message ?? "Invalid request body");
    }

    const { email, password } = parsed.data;
    const found = await prisma.user.findUnique({ where: { email }, select: USER_SELECT });

    const passwordValid = await verifyPassword(password, found?.passwordHash ?? DUMMY_PASSWORD_HASH);
    if (!found || !passwordValid) {
      throw new HttpError(401, "Invalid email or password");
    }

    const accessToken = await signAccessToken({ sub: found.id, role: found.role });
    const { token: refreshToken } = await createRefreshToken(found.id);
    await setAuthCookies(accessToken, refreshToken);

    const user = { id: found.id, email: found.email, name: found.name, role: found.role };
    return NextResponse.json({ user });
  } catch (error) {
    return errorResponse(error);
  }
}
