import { NextResponse } from "next/server";
import { errorResponse, HttpError } from "@/lib/auth/guards";
import { preflightResponse } from "@/lib/http/cors";

// Any /api/v1/* path no other route matches: the usual JSON error, not Next's HTML 404 page.
// Real routes always win over this catch-all.
export const dynamic = "force-dynamic";

export async function OPTIONS(request: Request): Promise<Response> {
  return preflightResponse(request);
}

function notFound(request: Request): NextResponse {
  return errorResponse(request, new HttpError(404, "NOT_FOUND", "No such endpoint"));
}

export { notFound as GET, notFound as POST, notFound as PUT, notFound as PATCH, notFound as DELETE, notFound as HEAD };
