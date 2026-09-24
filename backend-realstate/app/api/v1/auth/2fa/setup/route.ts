import { NextResponse } from "next/server";
import { assertCurrentPassword, beginTotpSetup } from "@/lib/auth/mfa";
import { errorResponse, jsonResponse, requireFreshAuth } from "@/lib/auth/guards";
import { preflightResponse } from "@/lib/http/cors";
import { readJsonBody } from "@/lib/http/body";
import { totpSetupSchema } from "@/lib/validation/auth";

export async function OPTIONS(request: Request): Promise<Response> {
  return preflightResponse(request);
}

// Step 1 of turning on 2FA. Body: { password } (omit for Google-only accounts).
// Returns { secret, otpauthUrl }: add it to an authenticator app, then call /2fa/enable.
export async function POST(request: Request): Promise<NextResponse> {
  try {
    const { password } = await readJsonBody(request, totpSetupSchema);
    const user = await requireFreshAuth(request);
    await assertCurrentPassword(user.id, password);

    return jsonResponse(request, await beginTotpSetup(user.id));
  } catch (error) {
    return errorResponse(request, error);
  }
}
