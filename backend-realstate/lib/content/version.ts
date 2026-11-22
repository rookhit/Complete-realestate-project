import { prisma } from "@/lib/prisma";

// The data version: a short string that changes whenever what the public lists show changes.
// The site asks for it first (GET /api/v1/site/version, cached for 2 s), then fetches the lists with
// ?v=<version>. Since every change gives a new version, and so a new address, Vercel's CDN can keep
// each versioned answer for a long time and still never serve an old list: an added, edited, sold or
// deleted property shows on the next page load, and in open tabs at their next check (30 s).
//
// properties: the latest updatedAt (every save, heart and status change touches it), the number of
// rows, and how many are sold / rented out or deleted (in case a bulk update doesn't touch updatedAt;
// a purge changes the row count). articles: the latest updatedAt and the number of rows (deleting an
// article removes its row).

export type DataVersion = { properties: string; articles: string };

export async function dataVersion(): Promise<DataVersion> {
  const [p, a] = await Promise.all([
    prisma.property.aggregate({ _max: { updatedAt: true }, _count: { _all: true, closedAt: true, deletedAt: true } }),
    prisma.article.aggregate({ _max: { updatedAt: true }, _count: { _all: true } }),
  ]);
  return {
    properties: [p._max.updatedAt?.getTime() ?? 0, p._count._all, p._count.closedAt, p._count.deletedAt].join("."),
    articles: [a._max.updatedAt?.getTime() ?? 0, a._count._all].join("."),
  };
}
