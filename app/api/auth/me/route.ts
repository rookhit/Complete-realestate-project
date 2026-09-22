import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { errorResponse, HttpError, requireAuth } from "@/lib/auth/guards";

export async function GET(): Promise<NextResponse> {
  try {
    const authUser = await requireAuth();
    const user = await prisma.user.findUnique({
      where: { id: authUser.id },
      select: { id: true, email: true, name: true, role: true },
    });

    if (!user) {
      throw new HttpError(401, "Login required");
    }

    return NextResponse.json(user);
  } catch (error) {
    return errorResponse(error);
  }
}
