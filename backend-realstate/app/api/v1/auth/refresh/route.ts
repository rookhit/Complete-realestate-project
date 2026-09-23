import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { rotateRefreshToken } from "@/lib/auth/refresh-token";
import { signAccessToken } from "@/lib/auth/jwt";
import { setRefreshCookie } from "@/lib/auth/cookies";
import {
  HttpError,
  errorResponse,
  jsonResponse,
  requireAllowedOrigin,
  requireJsonContentType,
} from "@/lib/auth/guards";
import { preflightResponse } from "@/lib/http/cors";

export async function OPTIONS(request: Request): Promise<Response> {
  return preflightResponse(request);
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    requireJsonContentType(request);
    requireAllowedOrigin(request);

    const cookieStore = await cookies();
    const refreshToken = cookieStore.get("refresh_token")?.value;
    if (!refreshToken) {
      throw new HttpError(401, "UNAUTHENTICATED", "Login required");
    }

    const rotated = await rotateRefreshToken(refreshToken);
    const accessToken = await signAccessToken({ sub: rotated.userId, role: rotated.role });
    await setRefreshCookie(rotated.token);

    return jsonResponse(request, { accessToken });
  } catch (error) {
    return errorResponse(request, error);
  }
}
