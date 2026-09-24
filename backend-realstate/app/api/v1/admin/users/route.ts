import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { errorResponse, jsonResponse, requireAdmin } from "@/lib/auth/guards";
import { preflightResponse } from "@/lib/http/cors";

const USER_SELECT = {
  id: true,
  email: true,
  name: true,
  phone: true,
  role: true,
  createdAt: true,
} as const;

export async function OPTIONS(request: Request): Promise<Response> {
  return preflightResponse(request);
}

export async function GET(request: Request): Promise<NextResponse> {
  try {
    await requireAdmin(request);

    const users = await prisma.user.findMany({
      select: USER_SELECT,
      orderBy: { createdAt: "desc" },
    });

    return jsonResponse(request, { users });
  } catch (error) {
    return errorResponse(request, error);
  }
}
