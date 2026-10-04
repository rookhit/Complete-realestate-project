import { NextResponse } from "next/server";
import { errorResponse, jsonResponse, requireAdmin } from "@/lib/auth/guards";
import { preflightResponse } from "@/lib/http/cors";
import { readJsonBody } from "@/lib/http/body";
import { idParam } from "@/lib/http/params";
import { updateListing } from "@/lib/content/listings";
import { listingPatchSchema } from "@/lib/validation/listing";

// PATCH /api/v1/admin/listings/:id { status?, draft?, propertyId? }
//   status: new | draft ("Save for later") | published | rejected (remembers the status before,
//   so Restore can put it back); draft: the admin's edited property (null clears it);
//   propertyId: the property it was published as (POST /admin/properties first).
// Always run per request (a [param] route: see app/api/v1/media/[...key]/route.ts).
export const dynamic = "force-dynamic";

export async function OPTIONS(request: Request): Promise<Response> {
  return preflightResponse(request);
}

export async function PATCH(request: Request, ctx: RouteContext<"/api/v1/admin/listings/[id]">): Promise<NextResponse> {
  try {
    await requireAdmin(request);
    const { id } = await ctx.params;
    const patch = await readJsonBody(request, listingPatchSchema);
    return jsonResponse(request, { data: await updateListing(idParam(id), patch) });
  } catch (error) {
    return errorResponse(request, error);
  }
}
