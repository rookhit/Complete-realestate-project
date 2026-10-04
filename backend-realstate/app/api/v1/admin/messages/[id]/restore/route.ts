import { NextResponse } from "next/server";
import { errorResponse, jsonResponse, requireAdmin, requireAllowedOrigin } from "@/lib/auth/guards";
import { preflightResponse } from "@/lib/http/cors";
import { idParam } from "@/lib/http/params";
import { restoreMessage } from "@/lib/content/messages";

// POST /api/v1/admin/messages/:id/restore — the admin's Undo after a delete (within 60 s; later → 404).
// Always run per request (a [param] route: see app/api/v1/media/[...key]/route.ts).
export const dynamic = "force-dynamic";

export async function OPTIONS(request: Request): Promise<Response> {
  return preflightResponse(request);
}

export async function POST(request: Request, ctx: RouteContext<"/api/v1/admin/messages/[id]/restore">): Promise<NextResponse> {
  try {
    await requireAdmin(request);
    requireAllowedOrigin(request);
    const { id } = await ctx.params;
    return jsonResponse(request, { data: await restoreMessage(idParam(id)) });
  } catch (error) {
    return errorResponse(request, error);
  }
}
