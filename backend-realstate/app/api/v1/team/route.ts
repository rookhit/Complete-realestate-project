import { NextResponse } from "next/server";
import { errorResponse, jsonResponse } from "@/lib/auth/guards";
import { preflightResponse } from "@/lib/http/cors";
import { listTeam } from "@/lib/content/team";

// GET /api/v1/team — every team member in display order (the About page shows the first six). Public.
export async function OPTIONS(request: Request): Promise<Response> {
  return preflightResponse(request);
}

export async function GET(request: Request): Promise<NextResponse> {
  try {
    return jsonResponse(request, { data: await listTeam() });
  } catch (error) {
    return errorResponse(request, error);
  }
}
