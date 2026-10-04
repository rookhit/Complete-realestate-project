import { NextResponse } from "next/server";
import { errorResponse, jsonResponse, requireAuth } from "@/lib/auth/guards";
import { preflightResponse } from "@/lib/http/cors";
import { myReactions } from "@/lib/content/reactions";

// GET /api/v1/me/reactions — the ids of the properties the signed-in user has hearted, { data: number[] }.
export async function OPTIONS(request: Request): Promise<Response> {
  return preflightResponse(request);
}

export async function GET(request: Request): Promise<NextResponse> {
  try {
    const user = await requireAuth(request);
    return jsonResponse(request, { data: await myReactions(user.id) });
  } catch (error) {
    return errorResponse(request, error);
  }
}
