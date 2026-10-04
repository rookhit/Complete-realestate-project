import { NextResponse } from "next/server";
import { errorResponse, jsonResponse, noContentResponse, requireAdmin, requireAllowedOrigin } from "@/lib/auth/guards";
import { preflightResponse } from "@/lib/http/cors";
import { readJsonBody } from "@/lib/http/body";
import { idParam } from "@/lib/http/params";
import { deleteArticle, getAdminArticle, updateArticle } from "@/lib/content/articles";
import { articlePatchSchema } from "@/lib/validation/article";

// GET    /api/v1/admin/articles/:id — one article (drafts too).
// PATCH  /api/v1/admin/articles/:id — change any subset of fields; the slug stays.
// DELETE /api/v1/admin/articles/:id — delete for good (its cover file too). 204.
// Always run per request (a [param] route: see app/api/v1/media/[...key]/route.ts).
export const dynamic = "force-dynamic";

export async function OPTIONS(request: Request): Promise<Response> {
  return preflightResponse(request);
}

type Ctx = RouteContext<"/api/v1/admin/articles/[id]">;

export async function GET(request: Request, ctx: Ctx): Promise<NextResponse> {
  try {
    await requireAdmin(request);
    const { id } = await ctx.params;
    return jsonResponse(request, { data: await getAdminArticle(idParam(id)) });
  } catch (error) {
    return errorResponse(request, error);
  }
}

export async function PATCH(request: Request, ctx: Ctx): Promise<NextResponse> {
  try {
    await requireAdmin(request);
    const { id } = await ctx.params;
    const patch = await readJsonBody(request, articlePatchSchema);
    return jsonResponse(request, { data: await updateArticle(idParam(id), patch) });
  } catch (error) {
    return errorResponse(request, error);
  }
}

export async function DELETE(request: Request, ctx: Ctx): Promise<NextResponse> {
  try {
    await requireAdmin(request);
    requireAllowedOrigin(request);
    const { id } = await ctx.params;
    await deleteArticle(idParam(id));
    return noContentResponse(request);
  } catch (error) {
    return errorResponse(request, error);
  }
}
