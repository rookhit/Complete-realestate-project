import { NextResponse } from "next/server";
import { errorResponse, jsonResponse, requireAdmin } from "@/lib/auth/guards";
import { preflightResponse } from "@/lib/http/cors";
import { queryObject } from "@/lib/http/params";
import { listMessages } from "@/lib/content/messages";
import { messageQuerySchema } from "@/lib/validation/message";

// GET /api/v1/admin/messages?kind=enquiry|callback|contact|email&unread=true&q&page&limit
// Newest first; { data, meta: { page, limit, total, totalPages, unread } }.
export async function OPTIONS(request: Request): Promise<Response> {
  return preflightResponse(request);
}

export async function GET(request: Request): Promise<NextResponse> {
  try {
    await requireAdmin(request);
    const query = messageQuerySchema.parse(queryObject(request));
    return jsonResponse(request, await listMessages(query));
  } catch (error) {
    return errorResponse(request, error);
  }
}
