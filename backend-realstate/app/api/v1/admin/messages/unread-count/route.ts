import { NextResponse } from "next/server";
import { errorResponse, jsonResponse, requireAdmin } from "@/lib/auth/guards";
import { preflightResponse } from "@/lib/http/cors";
import { unreadMessageCount } from "@/lib/content/messages";

// GET /api/v1/admin/messages/unread-count → { data: { unread } }, for the red badge.
export async function OPTIONS(request: Request): Promise<Response> {
  return preflightResponse(request);
}

export async function GET(request: Request): Promise<NextResponse> {
  try {
    await requireAdmin(request);
    return jsonResponse(request, { data: { unread: await unreadMessageCount() } });
  } catch (error) {
    return errorResponse(request, error);
  }
}
