import { NextResponse } from "next/server";
import { z } from "zod";
import { errorResponse, jsonResponse, requireAdmin } from "@/lib/auth/guards";
import { preflightResponse } from "@/lib/http/cors";
import { readJsonBody } from "@/lib/http/body";
import { createUpload } from "@/lib/storage/r2";

// POST /api/v1/admin/uploads  { kind: "image" | "video", contentType, size, folder?: "properties" | "articles" | "team" | "testimonials" | "site" }
// → 201 { data: { uploadUrl, url, key, headers } }. The browser then PUTs the file to uploadUrl
// (with `headers`) straight to Cloudflare R2 and keeps `url` for the property's gallery / videoUrl.
// Images: JPG, PNG, WebP, AVIF, GIF up to 8 MB. Videos: MP4, MOV, WebM up to 500 MB.
// Without the R2 settings: in development the file goes to the local test store instead
// (lib/storage/local.ts); in production 503 SERVICE_UNAVAILABLE.
export async function OPTIONS(request: Request): Promise<Response> {
  return preflightResponse(request);
}

const uploadSchema = z.object({
  kind: z.enum(["image", "video"]),
  contentType: z.string().trim().toLowerCase().min(1).max(100),
  size: z.number().int().positive("The file is empty"),
  // properties (default): photos and videos; articles (journal covers), team (portraits) and
  // testimonials (client photos), site (featured district tiles): images only.
  folder: z.enum(["properties", "articles", "team", "testimonials", "site"]).default("properties"),
}).refine((v) => v.folder === "properties" || v.kind === "image", { message: "Only images can be uploaded here", path: ["kind"] });

export async function POST(request: Request): Promise<NextResponse> {
  try {
    await requireAdmin(request);
    const { kind, contentType, size, folder } = await readJsonBody(request, uploadSchema);
    return jsonResponse(request, { data: await createUpload(kind, contentType, size, folder, new URL(request.url).origin) }, 201);
  } catch (error) {
    return errorResponse(request, error);
  }
}
