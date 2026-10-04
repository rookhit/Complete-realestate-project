import { NextResponse } from "next/server";
import { errorResponse, jsonResponse, requireAdmin } from "@/lib/auth/guards";
import { preflightResponse } from "@/lib/http/cors";
import { readJsonBody } from "@/lib/http/body";
import { reorderTeam } from "@/lib/content/team";
import { teamOrderSchema } from "@/lib/validation/team";

// PUT /api/v1/admin/team/order { ids } — every member id in display order. Returns the list in
// its new order. 409 if the ids don't match the team (someone else changed it).
export async function OPTIONS(request: Request): Promise<Response> {
  return preflightResponse(request);
}

export async function PUT(request: Request): Promise<NextResponse> {
  try {
    await requireAdmin(request);
    const { ids } = await readJsonBody(request, teamOrderSchema);
    return jsonResponse(request, { data: await reorderTeam(ids) });
  } catch (error) {
    return errorResponse(request, error);
  }
}
