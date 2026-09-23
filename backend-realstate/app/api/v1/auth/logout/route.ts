import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { revokeRefreshToken } from "@/lib/auth/refresh-token";
import { clearRefreshCookie } from "@/lib/auth/cookies";
import { errorResponse, noContentResponse, requireAllowedOrigin, requireJsonContentType } from "@/lib/auth/guards";
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
    if (refreshToken) {
      await revokeRefreshToken(refreshToken);
    }

    await clearRefreshCookie();

    return noContentResponse(request);
  } catch (error) {
    return errorResponse(request, error);
  }
}
