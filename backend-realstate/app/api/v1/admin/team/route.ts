import { NextResponse } from "next/server";
import { errorResponse, jsonResponse, requireAdmin } from "@/lib/auth/guards";
import { preflightResponse } from "@/lib/http/cors";
import { readJsonBody } from "@/lib/http/body";
import { createMember, listTeam } from "@/lib/content/team";
import { teamInputSchema } from "@/lib/validation/team";

// GET  /api/v1/admin/team — every member in display order (same as the public list).
// POST /api/v1/admin/team — add a member; they go last. 201.
export async function OPTIONS(request: Request): Promise<Response> {
  return preflightResponse(request);
}

export async function GET(request: Request): Promise<NextResponse> {
  try {
    await requireAdmin(request);
    return jsonResponse(request, { data: await listTeam() });
  } catch (error) {
    return errorResponse(request, error);
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    await requireAdmin(request);
    const input = await readJsonBody(request, teamInputSchema);
    return jsonResponse(request, { data: await createMember(input) }, 201);
  } catch (error) {
    return errorResponse(request, error);
  }
}
