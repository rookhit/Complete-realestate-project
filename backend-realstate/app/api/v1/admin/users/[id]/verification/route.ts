import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  HttpError,
  errorResponse,
  jsonResponse,
  requireAdmin,
  requireAllowedOrigin,
  requireJsonContentType,
} from "@/lib/auth/guards";
import { preflightResponse } from "@/lib/http/cors";
import { verificationStatusSchema } from "@/lib/validation/auth";

const USER_SELECT = {
  id: true,
  email: true,
  name: true,
  phone: true,
  role: true,
  accountType: true,
  agencyName: true,
  licenseNumber: true,
  verificationStatus: true,
} as const;

export async function OPTIONS(request: Request): Promise<Response> {
  return preflightResponse(request);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    requireJsonContentType(request);
    requireAllowedOrigin(request);
    await requireAdmin(request);

    const { id } = await params;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new HttpError(400, "VALIDATION_FAILED", "Invalid JSON body");
    }

    const parsed = verificationStatusSchema.safeParse(body);
    if (!parsed.success) {
      throw new HttpError(400, "VALIDATION_FAILED", parsed.error.issues[0]?.message ?? "Invalid request body");
    }

    const user = await prisma.user
      .update({
        where: { id },
        data: { verificationStatus: parsed.data.status },
        select: USER_SELECT,
      })
      .catch(() => {
        throw new HttpError(404, "NOT_FOUND", "User not found");
      });

    return jsonResponse(request, { user });
  } catch (error) {
    return errorResponse(request, error);
  }
}
