import { propertyPage } from "@/lib/seo/pages";
import { seoResponse, seoUnavailable } from "@/lib/seo/response";

// GET /seo/property/:slug — the HTML of a property page with its own title, description, preview photo
// and structured data (lib/seo/pages.ts). The website's host forwards /property/:slug here
// (frontend-realstate/vercel.json), so a property added or changed after a deploy is right for Google
// and link previews within about 2 minutes. 404 + noindex when it isn't listed (sold, deleted, unknown).
export const dynamic = "force-dynamic";

export async function GET(_request: Request, ctx: RouteContext<"/seo/property/[slug]">): Promise<Response> {
  try {
    const { slug } = await ctx.params;
    const page = await propertyPage(slug);
    return seoResponse(page.html, page.status, "text/html; charset=utf-8");
  } catch (error) {
    return seoUnavailable(error);
  }
}
