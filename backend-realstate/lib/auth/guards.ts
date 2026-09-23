import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import type { Role } from "@/generated/prisma/client";
import { verifyAccessToken } from "@/lib/auth/jwt";
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

  constructor(status: number, code: ErrorCode, message: string, fields?: Record<string, string>) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

export type AuthUser = {
  id: string;
  role: Role;
};

export async function getAuthUser(request: Request): Promise<AuthUser | null> {
  const header = request.headers.get("authorization") ?? "";
  const [scheme, token] = header.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) return null;

  try {
    const payload = await verifyAccessToken(token);
    return { id: payload.sub, role: payload.role };
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

export async function requireAdmin(request: Request): Promise<AuthUser> {
  const user = await requireAuth(request);
  if (user.role !== "ADMIN") {
    throw new HttpError(403, "FORBIDDEN", "Forbidden");
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
  if (!allowedOrigin) return;

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
      { status: error.status, headers: corsHeaders(request) },
    );
  }

  console.error(error);
  return NextResponse.json(
    { error: { code: "INTERNAL", message: "Internal server error", requestId } },
    { status: 500, headers: corsHeaders(request) },
  );
}
