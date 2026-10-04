import { NextResponse } from "next/server";
import { errorResponse, jsonResponse, requireAdmin } from "@/lib/auth/guards";
import { preflightResponse } from "@/lib/http/cors";
import { listListings } from "@/lib/content/listings";

// GET /api/v1/admin/listings — every free listing, newest first, with the seller's private
// details and account; meta { total, new }.
export async function OPTIONS(request: Request): Promise<Response> {
  return preflightResponse(request);
}

export async function GET(request: Request): Promise<NextResponse> {
  try {
    await requireAdmin(request);
    return jsonResponse(request, await listListings());
  } catch (error) {
    return errorResponse(request, error);
  }
}
