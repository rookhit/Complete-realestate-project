import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { hashPassword } from "@/lib/auth/password";
import { signAccessToken } from "@/lib/auth/jwt";
import { createRefreshToken } from "@/lib/auth/refresh-token";
import { setAuthCookies } from "@/lib/auth/cookies";
import { HttpError, errorResponse, requireAllowedOrigin, requireJsonContentType } from "@/lib/auth/guards";
import { registerSchema } from "@/lib/validation/auth";

const USER_SELECT = { id: true, email: true, name: true, role: true } as const;

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

    const parsed = registerSchema.safeParse(body);
    if (!parsed.success) {
      throw new HttpError(400, parsed.error.issues[0]?.message ?? "Invalid request body");
    }

    const { email, password, name } = parsed.data;
    const passwordHash = await hashPassword(password);

    const user = await prisma.user
      .create({
        data: { email, passwordHash, name },
        select: USER_SELECT,
      })
      .catch((error: unknown) => {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
          throw new HttpError(409, "Email already registered");
        }
        throw error;
      });

    const accessToken = await signAccessToken({ sub: user.id, role: user.role });
    const { token: refreshToken } = await createRefreshToken(user.id);
    await setAuthCookies(accessToken, refreshToken);

    return NextResponse.json({ user });
  } catch (error) {
    return errorResponse(error);
  }
}
