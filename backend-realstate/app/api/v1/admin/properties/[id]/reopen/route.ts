import { NextResponse } from "next/server";
import { errorResponse, jsonResponse, requireAdmin, requireAllowedOrigin } from "@/lib/auth/guards";
import { preflightResponse } from "@/lib/http/cors";
import { idParam } from "@/lib/http/params";
import { setPropertyClosed } from "@/lib/content/properties";

// POST /api/v1/admin/properties/:id/reopen — a sold / rented-out property goes back on the website
// (e.g. the deal fell through, or a rental is free again). Returns the property with `closedAt: null`.
// 409 if it is already on the website; 404 if it doesn't exist.
// Always run per request (a [param] route: see app/api/v1/media/[...key]/route.ts).
export const dynamic = "force-dynamic";

export async function OPTIONS(request: Request): Promise<Response> {
  return preflightResponse(request);
}

export async function POST(request: Request, ctx: RouteContext<"/api/v1/admin/properties/[id]/reopen">): Promise<NextResponse> {
  try {
    await requireAdmin(request);
    requireAllowedOrigin(request);
    const { id } = await ctx.params;
    return jsonResponse(request, { data: await setPropertyClosed(idParam(id), false) });
  } catch (error) {
    return errorResponse(request, error);
  }
}
