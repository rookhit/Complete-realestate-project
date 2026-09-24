import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { rotateRefreshToken } from "@/lib/auth/refresh-token";
import { signAccessToken } from "@/lib/auth/jwt";
import { clearRefreshCookie, setRefreshCookie } from "@/lib/auth/cookies";
import {
  HttpError,
  errorResponse,
  jsonResponse,
  requireAllowedOrigin,
  requireJsonContentType,
} from "@/lib/auth/guards";
import { preflightResponse } from "@/lib/http/cors";
import { getRequestContext } from "@/lib/http/request-context";

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

    const rotated = await rotateRefreshToken(refreshToken, getRequestContext(request));
    const accessToken = await signAccessToken({ sub: rotated.userId, role: rotated.role });
    await setRefreshCookie(rotated.token);

    return jsonResponse(request, { accessToken });
  } catch (error) {
    // A dead refresh token will never work again, so drop the cookie instead of letting the
    // browser keep sending it. Not for 409 (lost a race with another tab): the browser's
    // cookie is by now the other tab's fresh one and must be kept.
    if (error instanceof HttpError && error.status === 401) await clearRefreshCookie();
    return errorResponse(request, error);
  }
}
