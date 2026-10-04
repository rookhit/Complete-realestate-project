import { NextResponse } from "next/server";
import { errorResponse, jsonResponse, requireAuth } from "@/lib/auth/guards";
import { enforceRateLimit } from "@/lib/auth/rate-limit";
import { preflightResponse } from "@/lib/http/cors";
import { readJsonBody } from "@/lib/http/body";
import { getRequestContext } from "@/lib/http/request-context";
import { createUpload } from "@/lib/storage/r2";
import { listingUploadSchema } from "@/lib/validation/listing";

// POST /api/v1/listings/uploads { contentType, size } — a signed upload link for one photo of a
// free listing. SIGNED-IN ONLY. Images only (JPG, PNG, WebP, AVIF, GIF ≤ 8 MB), stored under
// listings/ (Cloudflare R2, or the local test store in development). 120/h per IP.
export async function OPTIONS(request: Request): Promise<Response> {
  return preflightResponse(request);
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    await requireAuth(request);
    const { contentType, size } = await readJsonBody(request, listingUploadSchema);
    await enforceRateLimit("listing-upload", getRequestContext(request).ip);
    return jsonResponse(request, { data: await createUpload("image", contentType, size, "listings", new URL(request.url).origin) }, 201);
  } catch (error) {
    return errorResponse(request, error);
  }
}
