import { NextResponse } from "next/server";
import { getGoogleProfile } from "@/lib/auth/google";
import { findOrCreateGoogleUser } from "@/lib/auth/oauth-account";
import { createRefreshToken } from "@/lib/auth/refresh-token";
import { consumeGoogleOAuthCookie, setMfaPendingCookie, setRefreshCookie } from "@/lib/auth/cookies";
import { signMfaToken } from "@/lib/auth/jwt";
import { prisma } from "@/lib/prisma";
import { recordSuccessfulLogin } from "@/lib/auth/login-lockout";
import { logAuthEvent } from "@/lib/auth/audit";
import { errorResponse } from "@/lib/auth/guards";
import { getRequestContext } from "@/lib/http/request-context";
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

    const context = getRequestContext(request);

    // Google proves the email, not the second factor: accounts with 2FA still need a code.
    const { totpEnabledAt } = await prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      select: { totpEnabledAt: true },
    });
    if (totpEnabledAt) {
      await setMfaPendingCookie(await signMfaToken(user.id));
      await logAuthEvent("mfa_challenge", { userId: user.id, context, metadata: { via: "google" } });
      return redirectToFrontend({ auth: "google_mfa" });
    }

    await recordSuccessfulLogin(user.id, context.ip);
    const { token: refreshToken } = await createRefreshToken(user.id, context);
    await setRefreshCookie(refreshToken);
    await logAuthEvent("google_login", { userId: user.id, context });

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
