import { NextResponse } from "next/server";
import { errorResponse, jsonResponse } from "@/lib/auth/guards";
import { preflightResponse } from "@/lib/http/cors";
import { loadSavedOptions } from "@/lib/content/options";

// GET /api/v1/site/options — every dropdown list the admin has saved, { data: { [key]: string[] } }.
// Lists never saved are left out: the site uses its own defaults for those. Public (the Contact
// page, the callback form and the Buy / Rent filters use them too).
export async function OPTIONS(request: Request): Promise<Response> {
  return preflightResponse(request);
}

export async function GET(request: Request): Promise<NextResponse> {
  try {
    return jsonResponse(request, { data: await loadSavedOptions() });
  } catch (error) {
    return errorResponse(request, error);
  }
}
