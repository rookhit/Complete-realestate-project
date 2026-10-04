import { NextResponse } from "next/server";
import { errorResponse, jsonResponse, requireAdmin } from "@/lib/auth/guards";
import { preflightResponse } from "@/lib/http/cors";
import { readJsonBody } from "@/lib/http/body";
import { reorderArticles } from "@/lib/content/articles";
import { articleOrderSchema } from "@/lib/validation/article";

// PUT /api/v1/admin/articles/order { ids } — every article id in display order (first = featured).
// Returns the list in its new order. 409 if the ids don't match the articles (someone else changed them).
export async function OPTIONS(request: Request): Promise<Response> {
  return preflightResponse(request);
}

export async function PUT(request: Request): Promise<NextResponse> {
  try {
    await requireAdmin(request);
    const { ids } = await readJsonBody(request, articleOrderSchema);
    return jsonResponse(request, { data: await reorderArticles(ids) });
  } catch (error) {
    return errorResponse(request, error);
  }
}
