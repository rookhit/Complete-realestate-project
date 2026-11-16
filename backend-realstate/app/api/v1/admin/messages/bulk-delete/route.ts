import { NextResponse } from "next/server";
import { errorResponse, jsonResponse, requireAdmin, requireAllowedOrigin } from "@/lib/auth/guards";
import { preflightResponse } from "@/lib/http/cors";
import { readJsonBody } from "@/lib/http/body";
import { deleteMessages } from "@/lib/content/messages";
import { messageIdsSchema } from "@/lib/validation/message";

// POST /api/v1/admin/messages/bulk-delete { ids: number[] } — "Delete selected" / "Delete all" in
// Admin → Messages (up to 5,000). Hidden at once; /bulk-restore with the same ids undoes it within
// 60 s, then they are deleted for good. { meta: { deleted } } = how many were deleted.
export async function OPTIONS(request: Request): Promise<Response> {
  return preflightResponse(request);
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    await requireAdmin(request);
    requireAllowedOrigin(request);
    const { ids } = await readJsonBody(request, messageIdsSchema);
    return jsonResponse(request, { data: null, meta: { deleted: await deleteMessages(ids) } });
  } catch (error) {
    return errorResponse(request, error);
  }
}
