import { NextResponse } from "next/server";
import { errorResponse, jsonResponse, requireAdmin } from "@/lib/auth/guards";
import { preflightResponse } from "@/lib/http/cors";
import { readJsonBody } from "@/lib/http/body";
import { createArticle, listAdminArticles } from "@/lib/content/articles";
import { articleInputSchema } from "@/lib/validation/article";

// GET  /api/v1/admin/articles — every article (drafts too), in display order.
// POST /api/v1/admin/articles — create; it goes first (the featured story). 201.
export async function OPTIONS(request: Request): Promise<Response> {
  return preflightResponse(request);
}

export async function GET(request: Request): Promise<NextResponse> {
  try {
    await requireAdmin(request);
    return jsonResponse(request, { data: await listAdminArticles() });
  } catch (error) {
    return errorResponse(request, error);
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    await requireAdmin(request);
    const input = await readJsonBody(request, articleInputSchema);
    return jsonResponse(request, { data: await createArticle(input) }, 201);
  } catch (error) {
    return errorResponse(request, error);
  }
}
