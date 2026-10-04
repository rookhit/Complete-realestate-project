import { NextResponse } from "next/server";
import { errorResponse, jsonResponse, requireAuth } from "@/lib/auth/guards";
import { enforceRateLimit } from "@/lib/auth/rate-limit";
import { preflightResponse } from "@/lib/http/cors";
import { readJsonBody } from "@/lib/http/body";
import { getRequestContext } from "@/lib/http/request-context";
import { createListing } from "@/lib/content/listings";
import { listingInputSchema } from "@/lib/validation/listing";

// POST /api/v1/listings — the Free Listing form. SIGNED-IN ONLY: the listing records the account
// (userId from the token). Photos are uploaded first (POST /api/v1/listings/uploads) and sent as
// URLs. → 201, status "new" (Admin → Free Listings). 10/h per IP.
export async function OPTIONS(request: Request): Promise<Response> {
  return preflightResponse(request);
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const user = await requireAuth(request);
    const input = await readJsonBody(request, listingInputSchema);
    await enforceRateLimit("send-listing", getRequestContext(request).ip);
    return jsonResponse(request, { data: await createListing(user.id, input) }, 201);
  } catch (error) {
    return errorResponse(request, error);
  }
}
