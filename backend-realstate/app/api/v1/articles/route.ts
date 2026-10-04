import { NextResponse } from "next/server";
import { errorResponse, jsonResponse } from "@/lib/auth/guards";
import { preflightResponse } from "@/lib/http/cors";
import { queryObject } from "@/lib/http/params";
import { listPublicArticles } from "@/lib/content/articles";
import { articleQuerySchema } from "@/lib/validation/article";

// GET /api/v1/articles?limit= — published journal articles in display order (first = featured). Public.
export async function OPTIONS(request: Request): Promise<Response> {
  return preflightResponse(request);
}

export async function GET(request: Request): Promise<NextResponse> {
  try {
    const { limit } = articleQuerySchema.parse(queryObject(request));
    return jsonResponse(request, { data: await listPublicArticles(limit) });
  } catch (error) {
    return errorResponse(request, error);
  }
}
