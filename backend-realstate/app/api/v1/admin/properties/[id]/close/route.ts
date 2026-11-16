import { NextResponse } from "next/server";
import { errorResponse, jsonResponse, requireAdmin, requireAllowedOrigin } from "@/lib/auth/guards";
import { preflightResponse } from "@/lib/http/cors";
import { idParam } from "@/lib/http/params";
import { setPropertyClosed } from "@/lib/content/properties";

// POST /api/v1/admin/properties/:id/close — sold (sale) or rented out (rent): hidden from the website at
// once, kept for the admin (Admin → Sold & Rented) with its NB ID, photos, reviews and hearts.
// Returns the property with `closedAt` set. 409 if it is already closed; 404 if it doesn't exist.
// Always run per request (a [param] route: see app/api/v1/media/[...key]/route.ts).
export const dynamic = "force-dynamic";

export async function OPTIONS(request: Request): Promise<Response> {
  return preflightResponse(request);
}

export async function POST(request: Request, ctx: RouteContext<"/api/v1/admin/properties/[id]/close">): Promise<NextResponse> {
  try {
    await requireAdmin(request);
    requireAllowedOrigin(request);
    const { id } = await ctx.params;
    return jsonResponse(request, { data: await setPropertyClosed(idParam(id), true) });
  } catch (error) {
    return errorResponse(request, error);
  }
}
