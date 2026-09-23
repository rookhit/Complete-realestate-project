import { NextResponse } from "next/server";
import { getGoogleProfile } from "@/lib/auth/google";
import { findOrCreateGoogleUser } from "@/lib/auth/oauth-account";
import { createRefreshToken } from "@/lib/auth/refresh-token";
import { consumeGoogleOAuthCookie, setRefreshCookie } from "@/lib/auth/cookies";
import { errorResponse } from "@/lib/auth/guards";
import { redirectToFrontend } from "@/lib/http/frontend-redirect";

// Google redirects the browser here with ?code&state. On success we set the normal refresh
// cookie and send the user back to the frontend, which then calls POST /api/v1/auth/refresh
// to get an access token — no token ever appears in a URL.
export async function GET(request: Request): Promise<NextResponse> {
  try {
    const params = new URL(request.url).searchParams;
    const code = params.get("code");
    const state = params.get("state");
    const saved = await consumeGoogleOAuthCookie();

    if (params.get("error") || !code || !state || !saved || saved.state !== state) {
      return redirectToFrontend({ auth_error: "google" });
    }

    const profile = await getGoogleProfile(code, saved.codeVerifier);
    const user = await findOrCreateGoogleUser(profile);

    const { token: refreshToken } = await createRefreshToken(user.id);
    await setRefreshCookie(refreshToken);

    return redirectToFrontend({ auth: "google" });
  } catch (error) {
    console.error(error);
    try {
      return redirectToFrontend({ auth_error: "google" });
    } catch {
      return errorResponse(request, error);
    }
  }
}
