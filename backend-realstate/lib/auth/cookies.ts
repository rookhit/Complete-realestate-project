import { cookies } from "next/headers";

const REFRESH_TOKEN_MAX_AGE = 7 * 24 * 60 * 60;
const REFRESH_TOKEN_PATH = "/api/v1/auth";

export async function setRefreshCookie(refreshToken: string): Promise<void> {
  const cookieStore = await cookies();
  const secure = process.env.NODE_ENV === "production";

  // strict: the cookie is only ever needed by fetch() calls from the frontend, never on a
  // navigation, so there is no reason to send it when another site links here.
  cookieStore.set("refresh_token", refreshToken, {
    httpOnly: true,
    secure,
    sameSite: "strict",
    path: REFRESH_TOKEN_PATH,
    maxAge: REFRESH_TOKEN_MAX_AGE,
  });
}

const GOOGLE_OAUTH_COOKIE = "google_oauth";
const GOOGLE_OAUTH_PATH = "/api/v1/auth/google";
const GOOGLE_OAUTH_MAX_AGE = 10 * 60;

export type GoogleOAuthCookie = {
  state: string;
  codeVerifier: string;
};

// Holds the OAuth state and PKCE verifier between the redirect to Google and the callback.
export async function setGoogleOAuthCookie(value: GoogleOAuthCookie): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(GOOGLE_OAUTH_COOKIE, `${value.state}.${value.codeVerifier}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: GOOGLE_OAUTH_PATH,
    maxAge: GOOGLE_OAUTH_MAX_AGE,
  });
}

// Reads and deletes the cookie in one step so a state/verifier pair can only be used once.
export async function consumeGoogleOAuthCookie(): Promise<GoogleOAuthCookie | null> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(GOOGLE_OAUTH_COOKIE)?.value;
  cookieStore.set(GOOGLE_OAUTH_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: GOOGLE_OAUTH_PATH,
    maxAge: 0,
  });

  const [state, codeVerifier] = raw?.split(".") ?? [];
  if (!state || !codeVerifier) return null;
  return { state, codeVerifier };
}

// Google sign-in for an account with 2FA: the pending 2FA challenge (the same 5-minute token
// /auth/login returns in its body) travels in this cookie instead, so it never goes in a URL.
const MFA_PENDING_COOKIE = "mfa_pending";
const MFA_PENDING_PATH = "/api/v1/auth/login/2fa";
const MFA_PENDING_MAX_AGE = 5 * 60;

export async function setMfaPendingCookie(mfaToken: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(MFA_PENDING_COOKIE, mfaToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: MFA_PENDING_PATH,
    maxAge: MFA_PENDING_MAX_AGE,
  });
}

export async function getMfaPendingCookie(): Promise<string | undefined> {
  const cookieStore = await cookies();
  return cookieStore.get(MFA_PENDING_COOKIE)?.value;
}

export async function clearMfaPendingCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(MFA_PENDING_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: MFA_PENDING_PATH,
    maxAge: 0,
  });
}

export async function clearRefreshCookie(): Promise<void> {
  const cookieStore = await cookies();
  const secure = process.env.NODE_ENV === "production";

  cookieStore.set("refresh_token", "", {
    httpOnly: true,
    secure,
    sameSite: "strict",
    path: REFRESH_TOKEN_PATH,
    maxAge: 0,
  });
}
