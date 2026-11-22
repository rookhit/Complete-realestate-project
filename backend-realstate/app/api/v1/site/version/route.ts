import { NextResponse } from "next/server";
import { errorResponse, publicJsonResponse } from "@/lib/auth/guards";
import { preflightResponse } from "@/lib/http/cors";
import { dataVersion } from "@/lib/content/version";

// GET /api/v1/site/version — { data: { properties, articles } }: short strings that change whenever
// what the public lists show changes (lib/content/version.ts). The site asks for it before loading the
// lists (and every 30 s in an open tab) and passes it as ?v=, so lists are fresh right after a change
// yet cached at the edge. Kept at the edge for 2 s only: one small query however many visitors ask.
export async function OPTIONS(request: Request): Promise<Response> {
  return preflightResponse(request);
}

export async function GET(request: Request): Promise<NextResponse> {
  try {
    return publicJsonResponse(request, { data: await dataVersion() }, { edge: "max-age=2" });
  } catch (error) {
    return errorResponse(request, error);
  }
}
