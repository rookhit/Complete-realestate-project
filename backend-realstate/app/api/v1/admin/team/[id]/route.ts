import { NextResponse } from "next/server";
import { errorResponse, jsonResponse, noContentResponse, requireAdmin, requireAllowedOrigin } from "@/lib/auth/guards";
import { preflightResponse } from "@/lib/http/cors";
import { readJsonBody } from "@/lib/http/body";
import { idParam } from "@/lib/http/params";
import { deleteMember, getMember, updateMember } from "@/lib/content/team";
import { teamPatchSchema } from "@/lib/validation/team";

// GET    /api/v1/admin/team/:id — one member.
// PATCH  /api/v1/admin/team/:id — change any subset of fields (photoUrl null removes the photo).
// DELETE /api/v1/admin/team/:id — remove for good (their photo file too). 204.
// Always run per request (a [param] route: see app/api/v1/media/[...key]/route.ts).
export const dynamic = "force-dynamic";

export async function OPTIONS(request: Request): Promise<Response> {
  return preflightResponse(request);
}

type Ctx = RouteContext<"/api/v1/admin/team/[id]">;

export async function GET(request: Request, ctx: Ctx): Promise<NextResponse> {
  try {
    await requireAdmin(request);
    const { id } = await ctx.params;
    return jsonResponse(request, { data: await getMember(idParam(id)) });
  } catch (error) {
    return errorResponse(request, error);
  }
}

export async function PATCH(request: Request, ctx: Ctx): Promise<NextResponse> {
  try {
    await requireAdmin(request);
    const { id } = await ctx.params;
    const patch = await readJsonBody(request, teamPatchSchema);
    return jsonResponse(request, { data: await updateMember(idParam(id), patch) });
  } catch (error) {
    return errorResponse(request, error);
  }
}

export async function DELETE(request: Request, ctx: Ctx): Promise<NextResponse> {
  try {
    await requireAdmin(request);
    requireAllowedOrigin(request);
    const { id } = await ctx.params;
    await deleteMember(idParam(id));
    return noContentResponse(request);
  } catch (error) {
    return errorResponse(request, error);
  }
}
