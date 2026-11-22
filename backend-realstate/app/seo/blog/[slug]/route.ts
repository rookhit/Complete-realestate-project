import { articlePage } from "@/lib/seo/pages";
import { seoResponse, seoUnavailable } from "@/lib/seo/response";

// GET /seo/blog/:slug — the HTML of a journal article with its own tags (lib/seo/pages.ts). The
// website's host forwards /blog/:slug here. 404 + noindex for drafts and unknown articles.
export const dynamic = "force-dynamic";

export async function GET(_request: Request, ctx: RouteContext<"/seo/blog/[slug]">): Promise<Response> {
  try {
    const { slug } = await ctx.params;
    const page = await articlePage(slug);
    return seoResponse(page.html, page.status, "text/html; charset=utf-8");
  } catch (error) {
    return seoUnavailable(error);
  }
}
