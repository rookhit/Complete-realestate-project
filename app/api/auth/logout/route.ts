import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { revokeRefreshToken } from "@/lib/auth/refresh-token";
import { clearAuthCookies } from "@/lib/auth/cookies";
import { errorResponse, requireAllowedOrigin, requireJsonContentType } from "@/lib/auth/guards";

export async function POST(request: Request): Promise<NextResponse> {
  try {
    requireJsonContentType(request);
    requireAllowedOrigin(request);

    const cookieStore = await cookies();
    const refreshToken = cookieStore.get("refresh_token")?.value;
    if (refreshToken) {
      await revokeRefreshToken(refreshToken);
    }

    await clearAuthCookies();

    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
