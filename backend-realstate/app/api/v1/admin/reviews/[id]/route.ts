import { NextResponse } from "next/server";
import { errorResponse, jsonResponse, noContentResponse, requireAdmin, requireAllowedOrigin } from "@/lib/auth/guards";
import { preflightResponse } from "@/lib/http/cors";
import { readJsonBody } from "@/lib/http/body";
import { idParam } from "@/lib/http/params";
import { deleteReview, updateReview } from "@/lib/content/reviews";
import { reviewPatchSchema } from "@/lib/validation/review";

// PATCH  /api/v1/admin/reviews/:id { status?, verified? } — approve ("published") / reject, and the
//        "Verified Visit" mark.
// DELETE /api/v1/admin/reviews/:id — hidden at once; restorable for 60 s (Undo), then deleted for good. 204.
// Always run per request (a [param] route: see app/api/v1/media/[...key]/route.ts).
export const dynamic = "force-dynamic";

export async function OPTIONS(request: Request): Promise<Response> {
  return preflightResponse(request);
}

type Ctx = RouteContext<"/api/v1/admin/reviews/[id]">;

export async function PATCH(request: Request, ctx: Ctx): Promise<NextResponse> {
  try {
    await requireAdmin(request);
    const { id } = await ctx.params;
    const patch = await readJsonBody(request, reviewPatchSchema);
    return jsonResponse(request, { data: await updateReview(idParam(id), patch) });
  } catch (error) {
    return errorResponse(request, error);
  }
}

export async function DELETE(request: Request, ctx: Ctx): Promise<NextResponse> {
  try {
    await requireAdmin(request);
    requireAllowedOrigin(request);
    const { id } = await ctx.params;
    await deleteReview(idParam(id));
    return noContentResponse(request);
  } catch (error) {
    return errorResponse(request, error);
  }
}
