import { NextResponse } from "next/server";
import { errorResponse, HttpError, jsonResponse, requireAdmin } from "@/lib/auth/guards";
import { preflightResponse } from "@/lib/http/cors";
import { idParam } from "@/lib/http/params";
import { nextNbId, parseListing } from "@/lib/content/properties";

// GET /api/v1/admin/properties/next-ref?listing=for-sale|for-rent[&exceptId=12]
// The NB ID the editor pre-fills: the lowest free number of that sequence (NBS or NBL).
// exceptId: the property being edited (its own number counts as free).
export async function OPTIONS(request: Request): Promise<Response> {
  return preflightResponse(request);
}

export async function GET(request: Request): Promise<NextResponse> {
  try {
    await requireAdmin(request);
    const params = new URL(request.url).searchParams;
    const listing = parseListing(params.get("listing") ?? undefined);
    if (!listing) throw new HttpError(400, "VALIDATION_FAILED", "listing must be for-sale or for-rent", { listing: "for-sale or for-rent" });
    const except = params.get("exceptId");
    return jsonResponse(request, { data: await nextNbId(listing, except ? idParam(except) : undefined) });
  } catch (error) {
    return errorResponse(request, error);
  }
}
