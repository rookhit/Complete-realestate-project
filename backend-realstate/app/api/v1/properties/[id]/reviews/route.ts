import { NextResponse } from "next/server";
import { errorResponse, jsonResponse, requireAuth } from "@/lib/auth/guards";
import { enforceRateLimit } from "@/lib/auth/rate-limit";
import { preflightResponse } from "@/lib/http/cors";
import { readJsonBody } from "@/lib/http/body";
import { idParam } from "@/lib/http/params";
import { getRequestContext } from "@/lib/http/request-context";
import { createReview, listPublicReviews } from "@/lib/content/reviews";
import { reviewInputSchema } from "@/lib/validation/review";

// GET  /api/v1/properties/:id/reviews — approved reviews, newest first; meta { count, average }. Public.
// POST /api/v1/properties/:id/reviews — { rating, text }. SIGNED-IN ONLY (name / photo from the
//      account). Stored as pending until the admin approves it. 201. 20/h per IP.
export const dynamic = "force-dynamic";

export async function OPTIONS(request: Request): Promise<Response> {
  return preflightResponse(request);
}

type Ctx = RouteContext<"/api/v1/properties/[id]/reviews">;

export async function GET(request: Request, ctx: Ctx): Promise<NextResponse> {
  try {
    const { id } = await ctx.params;
    return jsonResponse(request, await listPublicReviews(idParam(id)));
  } catch (error) {
    return errorResponse(request, error);
  }
}

export async function POST(request: Request, ctx: Ctx): Promise<NextResponse> {
  try {
    const user = await requireAuth(request);
    const { id } = await ctx.params;
    const input = await readJsonBody(request, reviewInputSchema);
    await enforceRateLimit("post-review", getRequestContext(request).ip);
    return jsonResponse(request, { data: await createReview(user.id, idParam(id), input) }, 201);
  } catch (error) {
    return errorResponse(request, error);
  }
}
