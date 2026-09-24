import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { cleanupExpiredTokens } from "@/lib/cron/cleanup-tokens";
import { HttpError, errorResponse, jsonResponse } from "@/lib/auth/guards";

// Called by a scheduler (Vercel Cron, GitHub Actions, cron-job.org...) with
// Authorization: Bearer <CRON_SECRET>. Disabled (404) while CRON_SECRET is not set.
export async function GET(request: Request): Promise<NextResponse> {
  try {
    const secret = process.env.CRON_SECRET;
    if (!secret || secret.length < 32) {
      throw new HttpError(404, "NOT_FOUND", "Not found");
    }

    const header = request.headers.get("authorization") ?? "";
    if (!sameSecret(header, `Bearer ${secret}`)) {
      throw new HttpError(401, "UNAUTHENTICATED", "Invalid cron secret");
    }

    const deleted = await cleanupExpiredTokens();
    return jsonResponse(request, { deleted });
  } catch (error) {
    return errorResponse(request, error);
  }
}

// Constant-time comparison (hashing first makes both sides the same length).
function sameSecret(a: string, b: string): boolean {
  const digest = (value: string): Buffer => createHash("sha256").update(value).digest();
  return timingSafeEqual(digest(a), digest(b));
}
