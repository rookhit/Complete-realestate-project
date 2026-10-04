// Journal article calls to the backend (backend-realstate/app/api/v1/articles, …/admin/articles).
// Every call goes through authFetch (base URL, bearer token, refresh on 401, ApiError).
import { authFetch } from "@/app/auth";
import type { BlogPost } from "@/app/data/content";

/** One article as the API sends it: the BlogPost shape with an ISO `date`, plus structured values. */
export type ApiArticle = {
  id: number; slug: string; title: string; cat: string; excerpt: string; body: string;
  image: string; author: string; read: string; readingMinutes: number;
  date: string | null; publishedAt: string | null; position: number; createdAt: string; updatedAt: string;
};

/** What POST / PATCH /admin/articles take (backend-realstate/lib/validation/article.ts). */
export type ArticleInput = {
  title: string; category: string; excerpt: string; body: string; coverUrl: string;
  /** ISO 8601; null = draft. Left out on create = now. */
  publishedAt?: string | null;
};

/** "2025-05-01T00:00:00Z" → "May 2025" (UTC, so the month never shifts with the time zone). */
export const monthOf = (iso: string | null): string =>
  iso ? new Date(iso).toLocaleDateString("en-GB", { month: "short", year: "numeric", timeZone: "UTC" }) : "Draft";

/** The site's BlogPost from an API article. */
export function toBlog(a: ApiArticle): BlogPost {
  return {
    id: a.id, slug: a.slug, cat: a.cat, date: monthOf(a.publishedAt), publishedAt: a.publishedAt, read: a.read,
    title: a.title, excerpt: a.excerpt, image: a.image, author: a.author, body: a.body || undefined,
  };
}

/** Every article: the admin also gets drafts. */
export async function fetchArticles(admin: boolean): Promise<ApiArticle[]> {
  return (await authFetch<{ data: ApiArticle[] }>(admin ? "/admin/articles" : "/articles")).data;
}

export const createArticle = (input: ArticleInput): Promise<{ data: ApiArticle }> =>
  authFetch("/admin/articles", { method: "POST", body: JSON.stringify(input) });

export const updateArticle = (id: number, input: Partial<ArticleInput>): Promise<{ data: ApiArticle }> =>
  authFetch(`/admin/articles/${id}`, { method: "PATCH", body: JSON.stringify(input) });

export const deleteArticleOnServer = (id: number): Promise<void> =>
  authFetch(`/admin/articles/${id}`, { method: "DELETE" });

/** Every article id in the new display order; resolves to the list in that order. */
export const reorderArticles = (ids: number[]): Promise<{ data: ApiArticle[] }> =>
  authFetch("/admin/articles/order", { method: "PUT", body: JSON.stringify({ ids }) });
