import { NextResponse } from "next/server";
import { buildGoogleAuthorizeUrl, createOAuthState, createPkcePair } from "@/lib/auth/google";
import { setGoogleOAuthCookie } from "@/lib/auth/cookies";
import { errorResponse } from "@/lib/auth/guards";
import { redirectToFrontend } from "@/lib/http/frontend-redirect";

// Browser navigation (not fetch): the frontend sends the user here, we send them on to Google.
export async function GET(request: Request): Promise<NextResponse> {
  try {
    const state = createOAuthState();
    const { verifier, challenge } = createPkcePair();
    const authorizeUrl = buildGoogleAuthorizeUrl(state, challenge);
    await setGoogleOAuthCookie({ state, codeVerifier: verifier });
    return NextResponse.redirect(authorizeUrl, 303);
  } catch (error) {
    console.error(error);
    try {
      return redirectToFrontend({ auth_error: "google" });
    } catch {
      return errorResponse(request, error);
    }
  }
}
