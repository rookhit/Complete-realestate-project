import { errorResponse, HttpError } from "@/lib/auth/guards";
import { contentTypeOf, isLocalKey, readLocal } from "@/lib/storage/local";

// GET /api/v1/media/<key> — FOR TESTING ONLY: serves a file from the local test store (.uploads/),
// the development stand-in for Cloudflare R2. Public, like R2's public URLs.
// Always run per request: without this, `next dev` tries to pre-render the [param] route at
// startup and its worker can crash ("Failed to generate static paths"), answering 500.
export const dynamic = "force-dynamic";

export async function GET(request: Request, ctx: RouteContext<"/api/v1/media/[...key]">): Promise<Response> {
  try {
    const key = (await ctx.params).key.join("/");
    const file = isLocalKey(key) ? await readLocal(key) : null;
    if (!file) throw new HttpError(404, "NOT_FOUND", "Not found");
    return new Response(file.stream, {
      headers: {
        "Content-Type": contentTypeOf(key),
        "Content-Length": String(file.size),
        // The key is random and never reused, so the file never changes.
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (error) {
    return errorResponse(request, error);
  }
}
