import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { completeTotpSetup } from "@/lib/auth/mfa";
import { revokeAllSessionsForUser } from "@/lib/auth/refresh-token";
import { startSession } from "@/lib/auth/session";
import { errorResponse, jsonResponse, requireFreshAuth } from "@/lib/auth/guards";
import { preflightResponse } from "@/lib/http/cors";
import { readJsonBody } from "@/lib/http/body";
import { getRequestContext } from "@/lib/http/request-context";
import { totpEnableSchema } from "@/lib/validation/auth";

export async function OPTIONS(request: Request): Promise<Response> {
  return preflightResponse(request);
}

// Step 2 of turning on 2FA. Body: { code } (the current 6-digit code from the app).
// Signs out every other session (they were created without 2FA) and starts a fresh one here.
// Returns { recoveryCodes, accessToken }. The recovery codes are shown only this once.
export async function POST(request: Request): Promise<NextResponse> {
  try {
    const context = getRequestContext(request);
    const { code } = await readJsonBody(request, totpEnableSchema);
    const auth = await requireFreshAuth(request);

    const recoveryCodes = await completeTotpSetup(auth.id, code);
    await revokeAllSessionsForUser(auth.id);

    const user = await prisma.user.findUniqueOrThrow({ where: { id: auth.id }, select: { id: true, role: true } });
    const accessToken = await startSession(user, context, "mfa_enabled");
    return jsonResponse(request, { recoveryCodes, accessToken });
  } catch (error) {
    return errorResponse(request, error);
  }
}
