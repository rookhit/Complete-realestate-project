import { NextResponse } from "next/server";
import { assertCurrentPassword, disableTotp, verifySecondFactor } from "@/lib/auth/mfa";
import { logAuthEvent } from "@/lib/auth/audit";
import { errorResponse, noContentResponse, requireFreshAuth } from "@/lib/auth/guards";
import { preflightResponse } from "@/lib/http/cors";
import { readJsonBody } from "@/lib/http/body";
import { getRequestContext } from "@/lib/http/request-context";
import { totpDisableSchema } from "@/lib/validation/auth";

export async function OPTIONS(request: Request): Promise<Response> {
  return preflightResponse(request);
}

// Turns 2FA off. Body: { password (omit for Google-only accounts), code (authenticator code
// or a recovery code) }. For the admin this also blocks admin endpoints until 2FA is back on.
export async function POST(request: Request): Promise<NextResponse> {
  try {
    const { password, code } = await readJsonBody(request, totpDisableSchema);
    const user = await requireFreshAuth(request);
    await assertCurrentPassword(user.id, password);
    await verifySecondFactor(user.id, code);

    await disableTotp(user.id);
    await logAuthEvent("mfa_disabled", { userId: user.id, context: getRequestContext(request) });
    return noContentResponse(request);
  } catch (error) {
    return errorResponse(request, error);
  }
}
