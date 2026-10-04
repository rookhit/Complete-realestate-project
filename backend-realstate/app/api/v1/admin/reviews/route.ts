import { NextResponse } from "next/server";
import { errorResponse, jsonResponse, requireAdmin } from "@/lib/auth/guards";
import { preflightResponse } from "@/lib/http/cors";
import { queryObject } from "@/lib/http/params";
import { listAdminReviews } from "@/lib/content/reviews";
import { reviewQuerySchema } from "@/lib/validation/review";

// GET /api/v1/admin/reviews?status=pending|published|rejected&propertyId — every review, newest
// first, with its property and the account that wrote it; meta { total, pending }.
export async function OPTIONS(request: Request): Promise<Response> {
  return preflightResponse(request);
}

export async function GET(request: Request): Promise<NextResponse> {
  try {
    await requireAdmin(request);
    return jsonResponse(request, await listAdminReviews(reviewQuerySchema.parse(queryObject(request))));
  } catch (error) {
    return errorResponse(request, error);
  }
}
