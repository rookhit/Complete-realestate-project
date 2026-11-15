import { NextResponse } from "next/server";
import { errorResponse, publicJsonResponse } from "@/lib/auth/guards";
import { preflightResponse } from "@/lib/http/cors";
import { loadWatermark } from "@/lib/content/watermark";

// GET /api/v1/site/watermark — { data: { enabled, text, logo, opacity, size } }: the mark the browser
// stamps on property photos before uploading them (the default until the admin saves one). Public:
// sellers' free-listing photos are stamped too. Saved with PUT /api/v1/admin/site/watermark.
export async function OPTIONS(request: Request): Promise<Response> {
  return preflightResponse(request);
}

export async function GET(request: Request): Promise<NextResponse> {
  try {
    return publicJsonResponse(request, { data: await loadWatermark() });
  } catch (error) {
    return errorResponse(request, error);
  }
}
