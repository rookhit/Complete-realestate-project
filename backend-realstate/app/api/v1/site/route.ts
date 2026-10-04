import { NextResponse } from "next/server";
import { errorResponse, jsonResponse } from "@/lib/auth/guards";
import { preflightResponse } from "@/lib/http/cors";
import { loadSite } from "@/lib/content/site";

// GET /api/v1/site — the site settings the admin has saved: { data: { stats?, featuredDistricts?,
// contact?, services? } }. A setting never saved is left out (the site keeps its defaults).
// Public. Dropdown lists are separate: GET /api/v1/site/options.
export async function OPTIONS(request: Request): Promise<Response> {
  return preflightResponse(request);
}

export async function GET(request: Request): Promise<NextResponse> {
  try {
    return jsonResponse(request, { data: await loadSite() });
  } catch (error) {
    return errorResponse(request, error);
  }
}
