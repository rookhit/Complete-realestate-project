import { prisma } from "@/lib/prisma";
import { DEFAULT_SITE_URL, articlePath, propertyPath } from "@/lib/seo/meta";

// sitemap.xml, built from the database on request (the frontend host forwards /sitemap.xml here), so a
// property or article is in it as soon as it is published and leaves it as soon as it is sold, rented
// out or deleted. Same addresses and priorities as the build used to write (scripts/prerender.mjs).

const esc = (s: string): string => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const day = (d: Date | null | undefined): string | undefined => d?.toISOString().slice(0, 10);
const newest = (dates: (Date | null)[]): Date | undefined =>
  dates.filter((d): d is Date => d !== null).sort((a, b) => b.getTime() - a.getTime())[0];

export async function sitemapXml(): Promise<string> {
  const site = (process.env.SITE_URL || DEFAULT_SITE_URL).replace(/\/+$/, "");
  const [properties, articles] = await Promise.all([
    prisma.property.findMany({
      where: { deletedAt: null, closedAt: null },
      select: { id: true, title: true, listing: true, updatedAt: true, location: { select: { district: true } } },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    }),
    prisma.article.findMany({
      where: { publishedAt: { not: null } },
      select: { id: true, slug: true, title: true, publishedAt: true, updatedAt: true },
      orderBy: [{ position: "asc" }, { id: "asc" }],
    }),
  ]);
  const sale = properties.filter((p) => p.listing === "FOR_SALE");
  const rent = properties.filter((p) => p.listing === "FOR_RENT");
  const districts = (list: typeof properties): string[] =>
    [...new Set(list.map((p) => p.location?.district).filter((d): d is string => !!d))];

  const urls: { loc: string; lastmod?: string; priority: string }[] = [
    { loc: "/", lastmod: day(newest(properties.map((p) => p.updatedAt))), priority: "1.0" },
    { loc: "/buy", lastmod: day(newest(sale.map((p) => p.updatedAt))), priority: "0.9" },
    { loc: "/rent", lastmod: day(newest(rent.map((p) => p.updatedAt))), priority: "0.9" },
    ...districts(sale).map((d) => ({ loc: `/buy?district=${encodeURIComponent(d)}`, priority: "0.8" })),
    ...districts(rent).map((d) => ({ loc: `/rent?district=${encodeURIComponent(d)}`, priority: "0.8" })),
    ...properties.map((p) => ({ loc: propertyPath(p), lastmod: day(p.updatedAt), priority: "0.8" })),
    { loc: "/blog", lastmod: day(newest(articles.map((a) => a.publishedAt))), priority: "0.7" },
    ...articles.map((a) => ({ loc: articlePath(a), lastmod: day(a.updatedAt ?? a.publishedAt), priority: "0.6" })),
    ...["/about", "/team", "/services", "/contact", "/emi-calculator", "/new-listings", "/hot", "/free-listing", "/faq"].map((loc) => ({ loc, priority: "0.5" })),
    ...["/privacy-policy", "/terms"].map((loc) => ({ loc, priority: "0.2" })),
  ];
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    urls.map((u) => `  <url><loc>${esc(site + u.loc)}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ""}<priority>${u.priority}</priority></url>`).join("\n") +
    `\n</urlset>\n`;
}
