import { cookies } from "next/headers";

const ACCESS_TOKEN_MAX_AGE = 15 * 60;
const REFRESH_TOKEN_MAX_AGE = 7 * 24 * 60 * 60;

export async function setAuthCookies(accessToken: string, refreshToken: string): Promise<void> {
  const cookieStore = await cookies();
  const secure = process.env.NODE_ENV === "production";

  cookieStore.set("access_token", accessToken, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: ACCESS_TOKEN_MAX_AGE,
  });

  cookieStore.set("refresh_token", refreshToken, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/api/auth",
    maxAge: REFRESH_TOKEN_MAX_AGE,
  });
}

export async function clearAuthCookies(): Promise<void> {
  const cookieStore = await cookies();
  const secure = process.env.NODE_ENV === "production";

  cookieStore.set("access_token", "", {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });

  cookieStore.set("refresh_token", "", {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/api/auth",
    maxAge: 0,
  });
}
