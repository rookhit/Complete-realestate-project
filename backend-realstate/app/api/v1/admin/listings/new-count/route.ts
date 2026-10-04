import { NextResponse } from "next/server";
import { errorResponse, jsonResponse, requireAdmin } from "@/lib/auth/guards";
import { preflightResponse } from "@/lib/http/cors";
import { newListingCount } from "@/lib/content/listings";

// GET /api/v1/admin/listings/new-count → { data: { new } }, for the red badge on Free Listings.
export async function OPTIONS(request: Request): Promise<Response> {
  return preflightResponse(request);
}

export async function GET(request: Request): Promise<NextResponse> {
  try {
    await requireAdmin(request);
    return jsonResponse(request, { data: { new: await newListingCount() } });
  } catch (error) {
    return errorResponse(request, error);
  }
}
