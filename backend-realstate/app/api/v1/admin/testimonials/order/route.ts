import { NextResponse } from "next/server";
import { errorResponse, jsonResponse, requireAdmin } from "@/lib/auth/guards";
import { preflightResponse } from "@/lib/http/cors";
import { readJsonBody } from "@/lib/http/body";
import { reorderTestimonials } from "@/lib/content/testimonials";
import { testimonialOrderSchema } from "@/lib/validation/testimonial";

// PUT /api/v1/admin/testimonials/order { ids } — every testimonial id in display order. Returns the
// list in its new order. 409 if the ids don't match (someone else changed the list).
export async function OPTIONS(request: Request): Promise<Response> {
  return preflightResponse(request);
}

export async function PUT(request: Request): Promise<NextResponse> {
  try {
    await requireAdmin(request);
    const { ids } = await readJsonBody(request, testimonialOrderSchema);
    return jsonResponse(request, { data: await reorderTestimonials(ids) });
  } catch (error) {
    return errorResponse(request, error);
  }
}
