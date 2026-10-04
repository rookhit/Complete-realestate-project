import { NextResponse } from "next/server";
import { z } from "zod";
import { errorResponse, jsonResponse, requireAdmin } from "@/lib/auth/guards";
import { preflightResponse } from "@/lib/http/cors";
import { readJsonBody } from "@/lib/http/body";
import { saveOptions } from "@/lib/content/options";

// PUT /api/v1/admin/site/options/:key { items: string[] } — replace one dropdown list (e.g.
// propertyTypes, badges, teamRoles, contactTopics; lib/content/options.ts OPTION_RULES). Returns
// the list as stored (trimmed, duplicates dropped). 404 for an unknown key, 400 below the minimum.
// Always run per request (a [param] route: see app/api/v1/media/[...key]/route.ts).
export const dynamic = "force-dynamic";

export async function OPTIONS(request: Request): Promise<Response> {
  return preflightResponse(request);
}

const bodySchema = z.object({ items: z.array(z.string().max(2000)).max(500) });

export async function PUT(request: Request, ctx: RouteContext<"/api/v1/admin/site/options/[key]">): Promise<NextResponse> {
  try {
    await requireAdmin(request);
    const { key } = await ctx.params;
    const { items } = await readJsonBody(request, bodySchema);
    return jsonResponse(request, { data: { key, items: await saveOptions(key, items) } });
  } catch (error) {
    return errorResponse(request, error);
  }
}
