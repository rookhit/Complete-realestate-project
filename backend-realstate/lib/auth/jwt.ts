import { SignJWT, jwtVerify } from "jose";
import type { Role } from "@/generated/prisma/client";

const ISSUER = "realstate-api";
const AUDIENCE = "realstate-api";
const ACCESS_TOKEN_TTL = "15m";

const rawSecret = process.env.JWT_ACCESS_SECRET;
if (!rawSecret || rawSecret.length < 32) {
  throw new Error("JWT_ACCESS_SECRET must be set to at least 32 characters");
}
const ACCESS_SECRET = new TextEncoder().encode(rawSecret);

export type AccessTokenPayload = {
  sub: string;
  role: Role;
};

export async function signAccessToken(payload: AccessTokenPayload): Promise<string> {
  return new SignJWT({ role: payload.role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(ACCESS_TOKEN_TTL)
    .sign(ACCESS_SECRET);
}

export async function verifyAccessToken(token: string): Promise<AccessTokenPayload> {
  const { payload } = await jwtVerify(token, ACCESS_SECRET, {
    algorithms: ["HS256"],
    issuer: ISSUER,
    audience: AUDIENCE,
  });

  if (typeof payload.sub !== "string" || (payload.role !== "USER" && payload.role !== "ADMIN")) {
    throw new Error("Invalid access token payload");
  }

  return { sub: payload.sub, role: payload.role };
}
