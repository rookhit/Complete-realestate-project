import { NextResponse } from "next/server";
import { errorResponse, jsonResponse } from "@/lib/auth/guards";
import { preflightResponse } from "@/lib/http/cors";
import { listTestimonials } from "@/lib/content/testimonials";

// GET /api/v1/testimonials — every client testimonial in display order. Public.
export async function OPTIONS(request: Request): Promise<Response> {
  return preflightResponse(request);
}

export async function GET(request: Request): Promise<NextResponse> {
  try {
    return jsonResponse(request, { data: await listTestimonials() });
  } catch (error) {
    return errorResponse(request, error);
  }
}
