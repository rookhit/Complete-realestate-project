import { NextResponse } from "next/server";
import { errorResponse, jsonResponse, requireAdmin } from "@/lib/auth/guards";
import { preflightResponse } from "@/lib/http/cors";
import { readJsonBody } from "@/lib/http/body";
import { queryObject } from "@/lib/http/params";
import { createProperty, listAdminProperties } from "@/lib/content/properties";
import { propertyInputSchema, propertyQuerySchema } from "@/lib/validation/property";

// GET  /api/v1/admin/properties — the admin list (same filters as the public one), with the
//      private location and the editor's values (`edit`).
// POST /api/v1/admin/properties — create. 409 REF_TAKEN when the NB ID is used by a live property.
export async function OPTIONS(request: Request): Promise<Response> {
  return preflightResponse(request);
}

export async function GET(request: Request): Promise<NextResponse> {
  try {
    await requireAdmin(request);
    const query = propertyQuerySchema.parse(queryObject(request));
    return jsonResponse(request, await listAdminProperties(query));
  } catch (error) {
    return errorResponse(request, error);
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    await requireAdmin(request);
    const input = await readJsonBody(request, propertyInputSchema);
    const { property, warnings } = await createProperty(input);
    return jsonResponse(request, { data: property, meta: { warnings } }, 201);
  } catch (error) {
    return errorResponse(request, error);
  }
}
