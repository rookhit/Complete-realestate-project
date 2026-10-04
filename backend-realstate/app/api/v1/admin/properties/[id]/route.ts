import { NextResponse } from "next/server";
import { errorResponse, jsonResponse, noContentResponse, requireAdmin, requireAllowedOrigin } from "@/lib/auth/guards";
import { preflightResponse } from "@/lib/http/cors";
import { readJsonBody } from "@/lib/http/body";
import { idParam } from "@/lib/http/params";
import { deleteProperty, getAdminProperty, updateProperty } from "@/lib/content/properties";
import { propertyPatchSchema } from "@/lib/validation/property";

// GET    /api/v1/admin/properties/:id — one property (deleted ones too), with the private location.
// PATCH  /api/v1/admin/properties/:id — change any subset of fields. A new NB ID (e.g. after
//        switching sale ↔ rent) must be free: 409 REF_TAKEN otherwise; the old one is freed.
// DELETE /api/v1/admin/properties/:id — hidden at once and the NB ID freed; restorable for 60 s (Undo),
//        then removed from the database for good. 204.
// Always run per request (a [param] route: see app/api/v1/media/[...key]/route.ts).
export const dynamic = "force-dynamic";

export async function OPTIONS(request: Request): Promise<Response> {
  return preflightResponse(request);
}

type Ctx = RouteContext<"/api/v1/admin/properties/[id]">;

export async function GET(request: Request, ctx: Ctx): Promise<NextResponse> {
  try {
    await requireAdmin(request);
    const { id } = await ctx.params;
    return jsonResponse(request, { data: await getAdminProperty(idParam(id)) });
  } catch (error) {
    return errorResponse(request, error);
  }
}

export async function PATCH(request: Request, ctx: Ctx): Promise<NextResponse> {
  try {
    await requireAdmin(request);
    const { id } = await ctx.params;
    const patch = await readJsonBody(request, propertyPatchSchema);
    const { property, warnings } = await updateProperty(idParam(id), patch);
    return jsonResponse(request, { data: property, meta: { warnings } });
  } catch (error) {
    return errorResponse(request, error);
  }
}

export async function DELETE(request: Request, ctx: Ctx): Promise<NextResponse> {
  try {
    await requireAdmin(request);
    requireAllowedOrigin(request);
    const { id } = await ctx.params;
    await deleteProperty(idParam(id));
    return noContentResponse(request);
  } catch (error) {
    return errorResponse(request, error);
  }
}
