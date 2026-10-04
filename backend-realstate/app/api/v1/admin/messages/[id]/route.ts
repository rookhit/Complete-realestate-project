import { NextResponse } from "next/server";
import { errorResponse, jsonResponse, noContentResponse, requireAdmin, requireAllowedOrigin } from "@/lib/auth/guards";
import { preflightResponse } from "@/lib/http/cors";
import { readJsonBody } from "@/lib/http/body";
import { idParam } from "@/lib/http/params";
import { deleteMessage, updateMessage } from "@/lib/content/messages";
import { messagePatchSchema } from "@/lib/validation/message";

// PATCH  /api/v1/admin/messages/:id { read?, replied? } — mark read / unread / replied.
// DELETE /api/v1/admin/messages/:id — hidden at once; restorable for 60 s (Undo), then deleted for good. 204.
// Always run per request (a [param] route: see app/api/v1/media/[...key]/route.ts).
export const dynamic = "force-dynamic";

export async function OPTIONS(request: Request): Promise<Response> {
  return preflightResponse(request);
}

type Ctx = RouteContext<"/api/v1/admin/messages/[id]">;

export async function PATCH(request: Request, ctx: Ctx): Promise<NextResponse> {
  try {
    await requireAdmin(request);
    const { id } = await ctx.params;
    const patch = await readJsonBody(request, messagePatchSchema);
    return jsonResponse(request, { data: await updateMessage(idParam(id), patch) });
  } catch (error) {
    return errorResponse(request, error);
  }
}

export async function DELETE(request: Request, ctx: Ctx): Promise<NextResponse> {
  try {
    await requireAdmin(request);
    requireAllowedOrigin(request);
    const { id } = await ctx.params;
    await deleteMessage(idParam(id));
    return noContentResponse(request);
  } catch (error) {
    return errorResponse(request, error);
  }
}
