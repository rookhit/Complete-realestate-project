import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendVerificationCode } from "@/lib/auth/email-verification";
import { enforceRateLimit } from "@/lib/auth/rate-limit";
import { logAuthEvent } from "@/lib/auth/audit";
import { errorResponse, noContentResponse } from "@/lib/auth/guards";
import { preflightResponse } from "@/lib/http/cors";
import { readJsonBody } from "@/lib/http/body";
import { getRequestContext } from "@/lib/http/request-context";
import { resendVerificationSchema } from "@/lib/validation/auth";

export async function OPTIONS(request: Request): Promise<Response> {
  return preflightResponse(request);
}

// { email } → always 204, so it can't be used to find out which emails are registered. A new
// code is emailed only to an unverified account, and at most once a minute.
export async function POST(request: Request): Promise<NextResponse> {
  try {
    const context = getRequestContext(request);
    const { email } = await readJsonBody(request, resendVerificationSchema);
    await enforceRateLimit("resend-verification", context.ip);

    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, emailVerifiedAt: true },
    });
    if (user && !user.emailVerifiedAt && (await sendVerificationCode(user))) {
      await logAuthEvent("email_verification_sent", { userId: user.id, context, metadata: { via: "resend" } });
    }

    return noContentResponse(request);
  } catch (error) {
    return errorResponse(request, error);
  }
}
