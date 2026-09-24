import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import type { Role } from "@/generated/prisma/client";
import { verifyAccessToken } from "@/lib/auth/jwt";
import { prisma } from "@/lib/prisma";
import { corsHeaders } from "@/lib/http/cors";

export type ErrorCode =
  | "VALIDATION_FAILED"
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "RATE_LIMITED"
  | "CONFLICT"
  | "INTERNAL";

export class HttpError extends Error {
  readonly status: number;
  readonly code: ErrorCode;
  readonly fields?: Record<string, string>;
  readonly headers?: Record<string, string>;

  constructor(
    status: number,
    code: ErrorCode,
    message: string,
    fields?: Record<string, string>,
    headers?: Record<string, string>,
  ) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.code = code;
    this.fields = fields;
    this.headers = headers;
  }
}

export type AuthUser = {
  id: string;
  role: Role;
  // Seconds since the epoch (the token's iat claim).
  tokenIssuedAt: number;
};

export type FreshAuthUser = AuthUser & {
  twoFactorEnabled: boolean;
};

export async function getAuthUser(request: Request): Promise<AuthUser | null> {
  const header = request.headers.get("authorization") ?? "";
  const [scheme, token] = header.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) return null;

  try {
    const payload = await verifyAccessToken(token);
    return { id: payload.sub, role: payload.role, tokenIssuedAt: payload.issuedAt };
  } catch {
    return null;
  }
}

export async function requireAuth(request: Request): Promise<AuthUser> {
  const user = await getAuthUser(request);
  if (!user) {
    throw new HttpError(401, "UNAUTHENTICATED", "Login required");
  }
  return user;
}

// requireAuth plus one database lookup: rejects access tokens issued before the user's
// sessions were revoked (password reset, stolen refresh token, Google linking) and uses the
// role from the database instead of the token. Use it for anything sensitive.
export async function requireFreshAuth(request: Request): Promise<FreshAuthUser> {
  const tokenUser = await requireAuth(request);
  const row = await prisma.user.findUnique({
    where: { id: tokenUser.id },
    select: { role: true, sessionsRevokedAt: true, totpEnabledAt: true },
  });

  // Compared in whole seconds (iat has no milliseconds): a token issued in the same second
  // as the revocation is accepted, so logging in right after a password reset works.
  const revokedAtSeconds = row?.sessionsRevokedAt ? Math.floor(row.sessionsRevokedAt.getTime() / 1000) : 0;
  if (!row || tokenUser.tokenIssuedAt < revokedAtSeconds) {
    throw new HttpError(401, "UNAUTHENTICATED", "Login required");
  }

  return { ...tokenUser, role: row.role, twoFactorEnabled: row.totpEnabledAt !== null };
}

// The admin must have 2FA turned on before any admin endpoint works.
export async function requireAdmin(request: Request): Promise<FreshAuthUser> {
  const user = await requireFreshAuth(request);
  if (user.role !== "ADMIN") {
    throw new HttpError(403, "FORBIDDEN", "Forbidden");
  }
  if (!user.twoFactorEnabled) {
    throw new HttpError(403, "FORBIDDEN", "Enable two-factor authentication to use admin features");
  }
  return user;
}

export function requireJsonContentType(request: Request): void {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("application/json")) {
    throw new HttpError(400, "VALIDATION_FAILED", "Content-Type must be application/json");
  }
}

export function requireAllowedOrigin(request: Request): void {
  const allowedOrigin = process.env.FRONTEND_ORIGIN;
  if (!allowedOrigin) {
    // Without it the Origin (CSRF) check can't run: allowed in development only.
    if (process.env.NODE_ENV === "production") {
      console.error("FRONTEND_ORIGIN is not set; rejecting state-changing request");
      throw new HttpError(500, "INTERNAL", "Server misconfigured");
    }
    return;
  }

  const origin = request.headers.get("origin");
  if (origin !== allowedOrigin) {
    throw new HttpError(403, "FORBIDDEN", "Forbidden");
  }
}

export function jsonResponse(request: Request, data: unknown, status = 200): NextResponse {
  return NextResponse.json(data, { status, headers: corsHeaders(request) });
}

export function noContentResponse(request: Request): NextResponse {
  return new NextResponse(null, { status: 204, headers: corsHeaders(request) });
}

export function errorResponse(request: Request, error: unknown): NextResponse {
  const requestId = randomUUID();

  if (error instanceof HttpError) {
    return NextResponse.json(
      { error: { code: error.code, message: error.message, fields: error.fields, requestId } },
      { status: error.status, headers: { ...corsHeaders(request), ...error.headers } },
    );
  }

  console.error(error);
  return NextResponse.json(
    { error: { code: "INTERNAL", message: "Internal server error", requestId } },
    { status: 500, headers: corsHeaders(request) },
  );
}
