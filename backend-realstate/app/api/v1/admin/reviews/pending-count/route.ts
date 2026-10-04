import { NextResponse } from "next/server";
import { errorResponse, jsonResponse, requireAdmin } from "@/lib/auth/guards";
import { preflightResponse } from "@/lib/http/cors";
import { pendingReviewCount } from "@/lib/content/reviews";

// GET /api/v1/admin/reviews/pending-count → { data: { pending } }, for the red badge on Reviews.
export async function OPTIONS(request: Request): Promise<Response> {
  return preflightResponse(request);
}

export async function GET(request: Request): Promise<NextResponse> {
  try {
    await requireAdmin(request);
    return jsonResponse(request, { data: { pending: await pendingReviewCount() } });
  } catch (error) {
    return errorResponse(request, error);
  }
}
