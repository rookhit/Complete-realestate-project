import { NextResponse } from "next/server";
import { errorResponse, jsonResponse, requireAuth } from "@/lib/auth/guards";
import { enforceRateLimit } from "@/lib/auth/rate-limit";
import { preflightResponse } from "@/lib/http/cors";
import { readJsonBody } from "@/lib/http/body";
import { getRequestContext } from "@/lib/http/request-context";
import { createContact } from "@/lib/content/messages";
import { contactSchema } from "@/lib/validation/message";

// POST /api/v1/contact — the Contact Us form. SIGNED-IN ONLY (userId from the token).
// { name, email, phone?, topic, message? } → 201. 30/h per IP.
export async function OPTIONS(request: Request): Promise<Response> {
  return preflightResponse(request);
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const user = await requireAuth(request);
    const input = await readJsonBody(request, contactSchema);
    await enforceRateLimit("send-message", getRequestContext(request).ip);
    return jsonResponse(request, { data: await createContact(user.id, input) }, 201);
  } catch (error) {
    return errorResponse(request, error);
  }
}
