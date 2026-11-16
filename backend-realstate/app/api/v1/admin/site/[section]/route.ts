import { NextResponse } from "next/server";
import { errorResponse, HttpError, jsonResponse, requireAdmin } from "@/lib/auth/guards";
import { preflightResponse } from "@/lib/http/cors";
import { readJsonBody } from "@/lib/http/body";
import {
  contactSchema, featuredDistrictsSchema, saveContact, saveFeaturedDistricts, saveServices, saveStats, servicesSchema, statsSchema,
} from "@/lib/content/site";
import { saveWatermark, watermarkSchema } from "@/lib/content/watermark";
import { loadNotifications, notificationsSchema, saveNotifications } from "@/lib/content/notifications";

// PUT /api/v1/admin/site/stats              { items: [{ value, label }] }        (1-8)
// PUT /api/v1/admin/site/featured-districts { items: [{ name, img }] }           (1-5, one of the 77 districts, uploaded photo)
// PUT /api/v1/admin/site/contact            { address, phone, whatsapp, email, hours, instagram, facebook, youtube, linkedin }
// PUT /api/v1/admin/site/services           { items: [{ icon, title, desc }] }   (1-24, in display order)
// PUT /api/v1/admin/site/watermark          { enabled, text, logo, opacity, size } (lib/content/watermark.ts)
// GET / PUT /api/v1/admin/site/notifications { email }: where new website messages are emailed ("" = the
//                                           business email). Private: not in GET /site (lib/content/notifications.ts).
// Each replaces that setting and returns it as stored. (Dropdown lists: /admin/site/options/:key.)
// Always run per request (a [param] route: see app/api/v1/media/[...key]/route.ts).
export const dynamic = "force-dynamic";

export async function OPTIONS(request: Request): Promise<Response> {
  return preflightResponse(request);
}

/** Admin-only reads of settings that GET /api/v1/site does not show. */
export async function GET(request: Request, ctx: RouteContext<"/api/v1/admin/site/[section]">): Promise<NextResponse> {
  try {
    await requireAdmin(request);
    const { section } = await ctx.params;
    if (section !== "notifications") throw new HttpError(404, "NOT_FOUND", "No such site setting");
    return jsonResponse(request, { data: await loadNotifications() });
  } catch (error) {
    return errorResponse(request, error);
  }
}

export async function PUT(request: Request, ctx: RouteContext<"/api/v1/admin/site/[section]">): Promise<NextResponse> {
  try {
    await requireAdmin(request);
    const { section } = await ctx.params;
    let data: unknown;
    switch (section) {
      case "stats": data = await saveStats(await readJsonBody(request, statsSchema)); break;
      case "featured-districts": data = await saveFeaturedDistricts(await readJsonBody(request, featuredDistrictsSchema)); break;
      case "contact": data = await saveContact(await readJsonBody(request, contactSchema)); break;
      case "services": data = await saveServices(await readJsonBody(request, servicesSchema)); break;
      case "watermark": data = await saveWatermark(await readJsonBody(request, watermarkSchema)); break;
      case "notifications": data = await saveNotifications(await readJsonBody(request, notificationsSchema)); break;
      default: throw new HttpError(404, "NOT_FOUND", "No such site setting");
    }
    return jsonResponse(request, { data });
  } catch (error) {
    return errorResponse(request, error);
  }
}
