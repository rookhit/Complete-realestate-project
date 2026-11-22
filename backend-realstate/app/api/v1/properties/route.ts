import { NextResponse } from "next/server";
import { errorResponse, publicJsonResponse } from "@/lib/auth/guards";
import { preflightResponse } from "@/lib/http/cors";
import { queryObject } from "@/lib/http/params";
import { listPublicProperties } from "@/lib/content/properties";
import { propertyQuerySchema } from "@/lib/validation/property";

// GET /api/v1/properties?listing&type&district&minPrice&maxPrice&preset&q&sort&page&limit&view&v
// Public. Live properties only; never the exact location unless the admin chose "exact".
// view=card: the slim card version (no gallery beyond the cover, no amenities / floor plan / video, a
// description excerpt); v=<data version>: cached at the edge for a day (lib/content/version.ts).
export async function OPTIONS(request: Request): Promise<Response> {
  return preflightResponse(request);
}

export async function GET(request: Request): Promise<NextResponse> {
  try {
    const query = propertyQuerySchema.parse(queryObject(request));
    return publicJsonResponse(request, await listPublicProperties(query), { versioned: true });
  } catch (error) {
    return errorResponse(request, error);
  }
}
