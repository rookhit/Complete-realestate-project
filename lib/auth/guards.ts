import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import type { Role } from "@/generated/prisma/client";
import { verifyAccessToken } from "@/lib/auth/jwt";

export class HttpError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "HttpError";
    this.status = status;
  }
}

export type AuthUser = {
  id: string;
  role: Role;
};

export async function getAuthUser(): Promise<AuthUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("access_token")?.value;
  if (!token) return null;

  try {
    const payload = await verifyAccessToken(token);
    return { id: payload.sub, role: payload.role };
  } catch {
    return null;
  }
}

export async function requireAuth(): Promise<AuthUser> {
  const user = await getAuthUser();
  if (!user) {
    throw new HttpError(401, "Login required");
  }
  return user;
}

export async function requireAdmin(): Promise<AuthUser> {
  const user = await requireAuth();
  if (user.role !== "ADMIN") {
    throw new HttpError(403, "Forbidden");
  }
  return user;
}

export function requireJsonContentType(request: Request): void {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("application/json")) {
    throw new HttpError(400, "Content-Type must be application/json");
  }
}

export function requireAllowedOrigin(request: Request): void {
  const allowedOrigin = process.env.FRONTEND_ORIGIN;
  if (!allowedOrigin) return;

  const origin = request.headers.get("origin");
  if (origin !== allowedOrigin) {
    throw new HttpError(403, "Forbidden");
  }
}

export function errorResponse(error: unknown): NextResponse {
  if (error instanceof HttpError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  console.error(error);
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}
