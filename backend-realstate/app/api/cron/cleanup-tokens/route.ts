import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { cleanupExpiredTokens } from "@/lib/cron/cleanup-tokens";
import { sweepUnusedUploads } from "@/lib/storage/sweep";
import { HttpError, errorResponse, jsonResponse } from "@/lib/auth/guards";

// Listing the bucket and searching the database takes a few seconds; leave room.
export const maxDuration = 60;

// Called once a day by Vercel Cron (vercel.json "crons"; Vercel sends Authorization: Bearer
// <CRON_SECRET> by itself) or any scheduler with that header. Disabled (404) while CRON_SECRET is not set.
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
    // Uploads never saved (cancelled editors, abandoned forms), older than 7 days: lib/storage/sweep.ts.
    // Its own try: a storage hiccup must not hide the result of the database cleanup.
    let unusedUploads: { deleted: number; freedBytes: number } | { error: string };
    try {
      const r = await sweepUnusedUploads({ apply: true });
      unusedUploads = { deleted: r.deleted, freedBytes: r.freedBytes };
    } catch (e) {
      console.error("Unused upload sweep failed", e);
      unusedUploads = { error: "sweep failed (see logs)" };
    }
    return jsonResponse(request, { deleted, unusedUploads });
  } catch (error) {
    return errorResponse(request, error);
  }
}

// Constant-time comparison (hashing first makes both sides the same length).
function sameSecret(a: string, b: string): boolean {
  const digest = (value: string): Buffer => createHash("sha256").update(value).digest();
  return timingSafeEqual(digest(a), digest(b));
}
