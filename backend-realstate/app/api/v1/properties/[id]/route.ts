import { NextResponse } from "next/server";
import { errorResponse, jsonResponse } from "@/lib/auth/guards";
import { preflightResponse } from "@/lib/http/cors";
import { idParam } from "@/lib/http/params";
import { getPublicProperty } from "@/lib/content/properties";

// GET /api/v1/properties/:id — one live property, full detail. Public.
// Always run per request: without this, `next dev` tries to pre-render the [param] route at
// startup and its worker can crash ("Failed to generate static paths"), answering 500.
export const dynamic = "force-dynamic";

export async function OPTIONS(request: Request): Promise<Response> {
  return preflightResponse(request);
}

export async function GET(request: Request, ctx: RouteContext<"/api/v1/properties/[id]">): Promise<NextResponse> {
  try {
    const { id } = await ctx.params;
    return jsonResponse(request, { data: await getPublicProperty(idParam(id)) });
  } catch (error) {
    return errorResponse(request, error);
  }
}
