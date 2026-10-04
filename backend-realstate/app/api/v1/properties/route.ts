import { NextResponse } from "next/server";
import { errorResponse, jsonResponse } from "@/lib/auth/guards";
import { preflightResponse } from "@/lib/http/cors";
import { queryObject } from "@/lib/http/params";
import { listPublicProperties } from "@/lib/content/properties";
import { propertyQuerySchema } from "@/lib/validation/property";

// GET /api/v1/properties?listing&type&district&minPrice&maxPrice&preset&q&sort&page&limit
// Public. Live properties only; never the exact location unless the admin chose "exact".
export async function OPTIONS(request: Request): Promise<Response> {
  return preflightResponse(request);
}

export async function GET(request: Request): Promise<NextResponse> {
  try {
    const query = propertyQuerySchema.parse(queryObject(request));
    return jsonResponse(request, await listPublicProperties(query));
  } catch (error) {
    return errorResponse(request, error);
  }
}
