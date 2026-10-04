import { NextResponse } from "next/server";
import { errorResponse, jsonResponse, noContentResponse, requireAdmin, requireAllowedOrigin } from "@/lib/auth/guards";
import { preflightResponse } from "@/lib/http/cors";
import { readJsonBody } from "@/lib/http/body";
import { idParam } from "@/lib/http/params";
import { deleteTestimonial, getTestimonial, updateTestimonial } from "@/lib/content/testimonials";
import { testimonialPatchSchema } from "@/lib/validation/testimonial";

// GET    /api/v1/admin/testimonials/:id — one testimonial.
// PATCH  /api/v1/admin/testimonials/:id — change any subset of fields (photoUrl null removes the photo).
// DELETE /api/v1/admin/testimonials/:id — delete for good (its photo file too). 204.
// Always run per request (a [param] route: see app/api/v1/media/[...key]/route.ts).
export const dynamic = "force-dynamic";

export async function OPTIONS(request: Request): Promise<Response> {
  return preflightResponse(request);
}

type Ctx = RouteContext<"/api/v1/admin/testimonials/[id]">;

export async function GET(request: Request, ctx: Ctx): Promise<NextResponse> {
  try {
    await requireAdmin(request);
    const { id } = await ctx.params;
    return jsonResponse(request, { data: await getTestimonial(idParam(id)) });
  } catch (error) {
    return errorResponse(request, error);
  }
}

export async function PATCH(request: Request, ctx: Ctx): Promise<NextResponse> {
  try {
    await requireAdmin(request);
    const { id } = await ctx.params;
    const patch = await readJsonBody(request, testimonialPatchSchema);
    return jsonResponse(request, { data: await updateTestimonial(idParam(id), patch) });
  } catch (error) {
    return errorResponse(request, error);
  }
}

export async function DELETE(request: Request, ctx: Ctx): Promise<NextResponse> {
  try {
    await requireAdmin(request);
    requireAllowedOrigin(request);
    const { id } = await ctx.params;
    await deleteTestimonial(idParam(id));
    return noContentResponse(request);
  } catch (error) {
    return errorResponse(request, error);
  }
}
