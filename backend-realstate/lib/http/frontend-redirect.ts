import { NextResponse } from "next/server";

// Redirects the browser back to the frontend. The target is always FRONTEND_ORIGIN from the
// environment, never a URL taken from the request, so this can't be used as an open redirect.
export function redirectToFrontend(params: Record<string, string>): NextResponse {
  const origin = process.env.FRONTEND_ORIGIN;
  if (!origin) {
    throw new Error("FRONTEND_ORIGIN must be set for browser redirects");
  }

  const url = new URL("/", origin);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return NextResponse.redirect(url, 303);
}
