import { NextResponse } from "next/server";
import { errorResponse, jsonResponse } from "@/lib/auth/guards";
import { preflightResponse } from "@/lib/http/cors";
import { getPublicArticle } from "@/lib/content/articles";

// GET /api/v1/articles/:slug — one published article. Public. Drafts are 404.
// Always run per request: without this, `next dev` tries to pre-render the [param] route at
// startup and its worker can crash ("Failed to generate static paths"), answering 500.
export const dynamic = "force-dynamic";

export async function OPTIONS(request: Request): Promise<Response> {
  return preflightResponse(request);
}

export async function GET(request: Request, ctx: RouteContext<"/api/v1/articles/[slug]">): Promise<NextResponse> {
  try {
    const { slug } = await ctx.params;
    return jsonResponse(request, { data: await getPublicArticle(slug.toLowerCase()) });
  } catch (error) {
    return errorResponse(request, error);
  }
}
