import type { Article } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { HttpError } from "@/lib/auth/guards";
import { deleteUnusedMedia } from "@/lib/storage/media";
import type { ArticleInput, ArticlePatch } from "@/lib/validation/article";

// The Property Journal: the queries behind /api/v1/articles (public) and /api/v1/admin/articles.
// Order is `position` (0 first): the first article is the featured story on the home page.

/** Every article is published under the firm's name (the frontend's ARTICLE_AUTHOR). */
export const ARTICLE_AUTHOR = "Nepal Bhoomi";

/**
 * The frontend's BlogPost shape (cat, date, read, image, author) plus the structured values.
 * `date` is ISO 8601 (publishedAt); the frontend formats it as "May 2025".
 */
export type ArticleOut = {
  id: number; slug: string; title: string; cat: string; excerpt: string; body: string;
  image: string; author: string; read: string; readingMinutes: number;
  date: string | null; publishedAt: string | null; position: number; createdAt: string; updatedAt: string;
};

export function toArticle(a: Article): ArticleOut {
  return {
    id: a.id, slug: a.slug, title: a.title, cat: a.category, excerpt: a.excerpt, body: a.body,
    image: a.coverUrl, author: a.authorName, read: `${a.readingMinutes} min`, readingMinutes: a.readingMinutes,
    date: a.publishedAt?.toISOString() ?? null, publishedAt: a.publishedAt?.toISOString() ?? null,
    position: a.position, createdAt: a.createdAt.toISOString(), updatedAt: a.updatedAt.toISOString(),
  };
}

/** Reading time at about 200 words a minute, at least 1 (same as the editor's readingTime()). */
export function readingMinutes(excerpt: string, body: string): number {
  const words = `${excerpt} ${body}`.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

/** "How to Buy Property in Nepal: 2025!" → "how-to-buy-property-in-nepal-2025". */
function slugify(title: string): string {
  const s = title.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80).replace(/-+$/, "");
  return s || "article";
}

/** A slug no other article has: "my-title", else "my-title-2", "my-title-3", … */
async function freeSlug(title: string): Promise<string> {
  const base = slugify(title);
  const taken = new Set((await prisma.article.findMany({ where: { slug: { startsWith: base } }, select: { slug: true } })).map((a) => a.slug));
  if (!taken.has(base)) return base;
  for (let n = 2; ; n++) if (!taken.has(`${base}-${n}`)) return `${base}-${n}`;
}

const ORDER = [{ position: "asc" as const }, { id: "asc" as const }];
const notFound = (): HttpError => new HttpError(404, "NOT_FOUND", "Article not found");

// ─── Public ─────────────────────────────────────────────────────────────────────

/** Published articles in display order. */
export async function listPublicArticles(limit: number): Promise<ArticleOut[]> {
  const rows = await prisma.article.findMany({ where: { publishedAt: { not: null } }, orderBy: ORDER, take: limit });
  return rows.map(toArticle);
}

export async function getPublicArticle(slug: string): Promise<ArticleOut> {
  const row = await prisma.article.findUnique({ where: { slug } });
  if (!row || !row.publishedAt) throw notFound();
  return toArticle(row);
}

// ─── Admin ──────────────────────────────────────────────────────────────────────

/** Every article, drafts too, in display order. */
export async function listAdminArticles(): Promise<ArticleOut[]> {
  return (await prisma.article.findMany({ orderBy: ORDER })).map(toArticle);
}

export async function getAdminArticle(id: number): Promise<ArticleOut> {
  const row = await prisma.article.findUnique({ where: { id } });
  if (!row) throw notFound();
  return toArticle(row);
}

/** A new article goes first (it becomes the featured story), as the editor shows it. */
export async function createArticle(v: ArticleInput): Promise<ArticleOut> {
  const slug = await freeSlug(v.title);
  const row = await prisma.$transaction(async (tx) => {
    await tx.article.updateMany({ data: { position: { increment: 1 } } });
    return tx.article.create({
      data: {
        slug, title: v.title, category: v.category, excerpt: v.excerpt, body: v.body, coverUrl: v.coverUrl,
        authorName: ARTICLE_AUTHOR, readingMinutes: readingMinutes(v.excerpt, v.body),
        publishedAt: v.publishedAt === undefined ? new Date() : v.publishedAt === null ? null : new Date(v.publishedAt),
        position: 0,
      },
    });
  });
  return toArticle(row);
}

/** Changes only the sent fields. The slug stays the same when the title changes, so links keep working. */
export async function updateArticle(id: number, patch: ArticlePatch): Promise<ArticleOut> {
  const saved = await prisma.article.findUnique({ where: { id } });
  if (!saved) throw notFound();
  const excerpt = patch.excerpt ?? saved.excerpt;
  const body = patch.body ?? saved.body;
  const row = await prisma.article.update({
    where: { id },
    data: {
      ...(patch.title !== undefined ? { title: patch.title } : {}),
      ...(patch.category !== undefined ? { category: patch.category } : {}),
      ...(patch.coverUrl !== undefined ? { coverUrl: patch.coverUrl } : {}),
      ...(patch.publishedAt !== undefined ? { publishedAt: patch.publishedAt === null ? null : new Date(patch.publishedAt) } : {}),
      excerpt, body, readingMinutes: readingMinutes(excerpt, body),
    },
  });
  // A replaced cover: delete the old file unless something else uses it.
  if (row.coverUrl !== saved.coverUrl) await deleteUnusedMedia([saved.coverUrl]);
  return toArticle(row);
}

/** Deleted for good (the admin confirms first; there is no Undo for articles), and its cover with it. */
export async function deleteArticle(id: number): Promise<void> {
  const row = await prisma.article.findUnique({ where: { id }, select: { coverUrl: true } });
  if (!row) throw notFound();
  await prisma.article.delete({ where: { id } });
  await deleteUnusedMedia([row.coverUrl]);
}

/** Sets the display order. `ids` must be every article exactly once. */
export async function reorderArticles(ids: number[]): Promise<ArticleOut[]> {
  const all = await prisma.article.findMany({ select: { id: true } });
  const known = new Set(all.map((a) => a.id));
  if (ids.length !== known.size || ids.some((id) => !known.has(id))) {
    throw new HttpError(409, "CONFLICT", "The article list has changed. Reload and try again.");
  }
  await prisma.$transaction(ids.map((id, position) => prisma.article.update({ where: { id }, data: { position } })));
  return listAdminArticles();
}
