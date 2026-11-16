import { NextResponse } from "next/server";
import { errorResponse, jsonResponse, requireAdmin, requireAllowedOrigin } from "@/lib/auth/guards";
import { preflightResponse } from "@/lib/http/cors";
import { readJsonBody } from "@/lib/http/body";
import { restoreMessages } from "@/lib/content/messages";
import { messageIdsSchema } from "@/lib/validation/message";

// POST /api/v1/admin/messages/bulk-restore { ids: number[] } — Undo of a bulk delete. Brings back
// those still inside the 60 s window; { data } = the restored messages (newest first).
export async function OPTIONS(request: Request): Promise<Response> {
  return preflightResponse(request);
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    await requireAdmin(request);
    requireAllowedOrigin(request);
    const { ids } = await readJsonBody(request, messageIdsSchema);
    return jsonResponse(request, { data: await restoreMessages(ids) });
  } catch (error) {
    return errorResponse(request, error);
  }
}
