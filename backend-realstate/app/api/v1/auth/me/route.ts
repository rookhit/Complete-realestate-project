import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { errorResponse, HttpError, jsonResponse, requireFreshAuth } from "@/lib/auth/guards";
import { preflightResponse } from "@/lib/http/cors";

const USER_SELECT = {
  id: true,
  email: true,
  name: true,
  phone: true,
  role: true,
  totpEnabledAt: true,
} as const;

export async function OPTIONS(request: Request): Promise<Response> {
  return preflightResponse(request);
}

export async function GET(request: Request): Promise<NextResponse> {
  try {
    const authUser = await requireFreshAuth(request);
    const user = await prisma.user.findUnique({
      where: { id: authUser.id },
      select: USER_SELECT,
    });

    if (!user) {
      throw new HttpError(401, "UNAUTHENTICATED", "Login required");
    }

    const { totpEnabledAt, ...profile } = user;
    return jsonResponse(request, { user: { ...profile, twoFactorEnabled: totpEnabledAt !== null } });
  } catch (error) {
    return errorResponse(request, error);
  }
}
