import { NextResponse } from "next/server";
import { errorResponse, jsonResponse, requireAuth } from "@/lib/auth/guards";
import { enforceRateLimit } from "@/lib/auth/rate-limit";
import { preflightResponse } from "@/lib/http/cors";
import { readJsonBody } from "@/lib/http/body";
import { getRequestContext } from "@/lib/http/request-context";
import { createEnquiry } from "@/lib/content/messages";
import { enquirySchema } from "@/lib/validation/message";

// POST /api/v1/enquiries — "Enquire About This Property". SIGNED-IN ONLY: the message records the
// account (userId from the token, never the body). { propertyId, name, email?, phone?, message? }
// (an email or a phone is required) → 201. 404 if the property isn't listed. 30/h per IP.
export async function OPTIONS(request: Request): Promise<Response> {
  return preflightResponse(request);
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const user = await requireAuth(request);
    const input = await readJsonBody(request, enquirySchema);
    await enforceRateLimit("send-message", getRequestContext(request).ip);
    return jsonResponse(request, { data: await createEnquiry(user.id, input) }, 201);
  } catch (error) {
    return errorResponse(request, error);
  }
}
