import { sitemapXml } from "@/lib/seo/sitemap";
import { seoResponse, seoUnavailable } from "@/lib/seo/response";

// GET /seo/sitemap — sitemap.xml from the database (lib/seo/sitemap.ts). The website's host forwards
// /sitemap.xml here, so new properties and articles are in it at once and sold ones drop out.
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  try {
    return seoResponse(await sitemapXml(), 200, "application/xml; charset=utf-8");
  } catch (error) {
    return seoUnavailable(error);
  }
}
