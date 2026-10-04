import { NextResponse } from "next/server";
import { errorResponse, jsonResponse, requireAdmin } from "@/lib/auth/guards";
import { preflightResponse } from "@/lib/http/cors";
import { readJsonBody } from "@/lib/http/body";
import { createTestimonial, listTestimonials } from "@/lib/content/testimonials";
import { testimonialInputSchema } from "@/lib/validation/testimonial";

// GET  /api/v1/admin/testimonials — every testimonial in display order (same as the public list).
// POST /api/v1/admin/testimonials — add one; it goes last. 201.
export async function OPTIONS(request: Request): Promise<Response> {
  return preflightResponse(request);
}

export async function GET(request: Request): Promise<NextResponse> {
  try {
    await requireAdmin(request);
    return jsonResponse(request, { data: await listTestimonials() });
  } catch (error) {
    return errorResponse(request, error);
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    await requireAdmin(request);
    const input = await readJsonBody(request, testimonialInputSchema);
    return jsonResponse(request, { data: await createTestimonial(input) }, 201);
  } catch (error) {
    return errorResponse(request, error);
  }
}
