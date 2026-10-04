import { NextResponse } from "next/server";
import { errorResponse, HttpError, noContentResponse } from "@/lib/auth/guards";
import { preflightResponse } from "@/lib/http/cors";
import { contentTypeOf, isLocalKey, localUploadsAllowed, verifyLocalUpload, writeLocal } from "@/lib/storage/local";
import { UPLOAD_RULES, uploadsConfigured } from "@/lib/storage/r2";

// PUT /api/v1/uploads/local/<key>?exp&sig — FOR TESTING ONLY (development without Cloudflare R2).
// Takes the file the browser sends after POST /admin/uploads gave it this signed URL (the signature
// stands in for the admin check, like R2's signed URLs), and saves it in .uploads/. 204.
// Always run per request: without this, `next dev` tries to pre-render the [...key] route and its
// worker can crash ("Failed to generate static paths"), answering 500.
export const dynamic = "force-dynamic";

export async function OPTIONS(request: Request): Promise<Response> {
  return preflightResponse(request);
}

export async function PUT(request: Request, ctx: RouteContext<"/api/v1/uploads/local/[...key]">): Promise<NextResponse> {
  try {
    if (!localUploadsAllowed() || uploadsConfigured()) throw new HttpError(404, "NOT_FOUND", "Not found");
    const key = (await ctx.params).key.join("/");
    const contentType = request.headers.get("content-type") ?? "";
    const q = new URL(request.url).searchParams;
    if (!isLocalKey(key) || contentType !== contentTypeOf(key) || !verifyLocalUpload(key, contentType, q.get("exp"), q.get("sig"))) {
      throw new HttpError(403, "FORBIDDEN", "This upload link is not valid (or has expired). Try again.");
    }
    if (!request.body) throw new HttpError(400, "VALIDATION_FAILED", "The file is empty");
    const maxBytes = UPLOAD_RULES[key.includes("/videos/") ? "video" : "image"].maxBytes;
    try {
      await writeLocal(key, request.body, maxBytes);
    } catch (e) {
      if (e instanceof Error && e.message === "TOO_LARGE") throw new HttpError(400, "VALIDATION_FAILED", "The file is too large");
      throw e;
    }
    return noContentResponse(request);
  } catch (error) {
    return errorResponse(request, error);
  }
}
