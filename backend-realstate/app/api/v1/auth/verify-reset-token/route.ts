import { NextResponse } from "next/server";
import { isPasswordResetTokenValid } from "@/lib/auth/password-reset";
import {
  HttpError,
  errorResponse,
  noContentResponse,
  requireAllowedOrigin,
  requireJsonContentType,
} from "@/lib/auth/guards";
import { preflightResponse } from "@/lib/http/cors";
import { verifyResetTokenSchema } from "@/lib/validation/auth";

export async function OPTIONS(request: Request): Promise<Response> {
  return preflightResponse(request);
}

// Lets the reset page check a link before showing the "new password" form.
// 204 = usable, 400 = unknown, used or expired. Does not use up the token.
export async function POST(request: Request): Promise<NextResponse> {
  try {
    requireJsonContentType(request);
    requireAllowedOrigin(request);

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new HttpError(400, "VALIDATION_FAILED", "Invalid JSON body");
    }

    const parsed = verifyResetTokenSchema.safeParse(body);
    if (!parsed.success || !(await isPasswordResetTokenValid(parsed.data.token))) {
      throw new HttpError(400, "VALIDATION_FAILED", "Invalid or expired reset token");
    }

    return noContentResponse(request);
  } catch (error) {
    return errorResponse(request, error);
  }
}
