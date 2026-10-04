import { NextResponse } from "next/server";
import { errorResponse, jsonResponse, requireAllowedOrigin, requireAuth } from "@/lib/auth/guards";
import { preflightResponse } from "@/lib/http/cors";
import { idParam } from "@/lib/http/params";
import { addReaction, removeReaction } from "@/lib/content/reactions";

// POST   /api/v1/properties/:id/reaction — heart the property. SIGNED-IN ONLY (userId from the token).
// DELETE /api/v1/properties/:id/reaction — remove the heart.
// Both are safe to repeat and return { data: { liked, reactionCount } } (the new shown count).
// Always run per request (a [param] route: see app/api/v1/media/[...key]/route.ts).
export const dynamic = "force-dynamic";

export async function OPTIONS(request: Request): Promise<Response> {
  return preflightResponse(request);
}

type Ctx = RouteContext<"/api/v1/properties/[id]/reaction">;

export async function POST(request: Request, ctx: Ctx): Promise<NextResponse> {
  try {
    const user = await requireAuth(request);
    requireAllowedOrigin(request);
    const { id } = await ctx.params;
    return jsonResponse(request, { data: await addReaction(user.id, idParam(id)) });
  } catch (error) {
    return errorResponse(request, error);
  }
}

export async function DELETE(request: Request, ctx: Ctx): Promise<NextResponse> {
  try {
    const user = await requireAuth(request);
    requireAllowedOrigin(request);
    const { id } = await ctx.params;
    return jsonResponse(request, { data: await removeReaction(user.id, idParam(id)) });
  } catch (error) {
    return errorResponse(request, error);
  }
}
