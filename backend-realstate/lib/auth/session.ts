import type { Prisma, Role } from "@/generated/prisma/client";
import { signAccessToken } from "@/lib/auth/jwt";
import { createRefreshToken } from "@/lib/auth/refresh-token";
import { setRefreshCookie } from "@/lib/auth/cookies";
import { recordSuccessfulLogin } from "@/lib/auth/login-lockout";
import { logAuthEvent, type AuditEvent } from "@/lib/auth/audit";
import type { RequestContext } from "@/lib/http/request-context";

// Signs the user in on this browser: new refresh token (cookie) + access token (returned),
// records the login time/IP and writes the audit event.
export async function startSession(
  user: { id: string; role: Role },
  context: RequestContext,
  event: AuditEvent,
  metadata?: Prisma.InputJsonObject,
): Promise<string> {
  const accessToken = await signAccessToken({ sub: user.id, role: user.role });
  const { token: refreshToken } = await createRefreshToken(user.id, context);
  await setRefreshCookie(refreshToken);
  await recordSuccessfulLogin(user.id, context.ip);
  await logAuthEvent(event, { userId: user.id, context, metadata });
  return accessToken;
}
