import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { rotateRefreshToken } from "@/lib/auth/refresh-token";
import { signAccessToken } from "@/lib/auth/jwt";
import { setAuthCookies } from "@/lib/auth/cookies";
import { HttpError, errorResponse, requireAllowedOrigin, requireJsonContentType } from "@/lib/auth/guards";

export async function POST(request: Request): Promise<NextResponse> {
  try {
    requireJsonContentType(request);
    requireAllowedOrigin(request);

    const cookieStore = await cookies();
    const refreshToken = cookieStore.get("refresh_token")?.value;
    if (!refreshToken) {
      throw new HttpError(401, "Login required");
    }

    const rotated = await rotateRefreshToken(refreshToken);
    const accessToken = await signAccessToken({ sub: rotated.userId, role: rotated.role });
    await setAuthCookies(accessToken, rotated.token);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
