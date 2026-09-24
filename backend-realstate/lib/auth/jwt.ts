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

export type VerifiedAccessToken = AccessTokenPayload & {
  // Seconds since the epoch, from the iat claim.
  issuedAt: number;
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

// Short-lived "password was right, now enter your 2FA code" token. A different audience, so it
// can never be used as an access token (verifyAccessToken requires AUDIENCE) and vice versa.
const MFA_AUDIENCE = "realstate-mfa";
const MFA_TOKEN_TTL = "5m";

export async function signMfaToken(userId: string): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuer(ISSUER)
    .setAudience(MFA_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(MFA_TOKEN_TTL)
    .sign(ACCESS_SECRET);
}

// Returns the user id, or null if the token is invalid or expired.
export async function verifyMfaToken(token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, ACCESS_SECRET, {
      algorithms: ["HS256"],
      issuer: ISSUER,
      audience: MFA_AUDIENCE,
    });
    return typeof payload.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
}

export async function verifyAccessToken(token: string): Promise<VerifiedAccessToken> {
  const { payload } = await jwtVerify(token, ACCESS_SECRET, {
    algorithms: ["HS256"],
    issuer: ISSUER,
    audience: AUDIENCE,
  });

  if (
    typeof payload.sub !== "string" ||
    typeof payload.iat !== "number" ||
    (payload.role !== "USER" && payload.role !== "ADMIN")
  ) {
    throw new Error("Invalid access token payload");
  }

  return { sub: payload.sub, role: payload.role, issuedAt: payload.iat };
}
