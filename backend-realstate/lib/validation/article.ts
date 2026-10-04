import { z } from "zod";

// What the admin's journal editor sends to POST / PATCH /api/v1/admin/articles. The author
// ("Nepal Bhoomi"), the slug and the reading time are set by the server, never sent.

const text = (max: number) => z.string().trim().max(max, `At most ${max} characters`);

const fields = {
  title: text(120).min(5, "Give the article a title"),
  // Free text shown above the title, e.g. "Market Report".
  category: text(30).min(1, "Enter a category"),
  // The card summary and the article's standfirst.
  excerpt: text(600).min(20, "Write a short summary (a sentence or two)"),
  // Full text; paragraphs separated by a blank line.
  body: text(50_000),
  // The cover photo: an http(s) URL (uploaded to Cloudflare R2 by the editor).
  coverUrl: z.string().trim().min(1, "Add a cover photo").max(2000, "Cover link is too long")
    .regex(/^https?:\/\/\S+$/i, "The cover must be an uploaded photo (a link starting with https://)"),
  // When it was published (the journal shows the month). null = draft, hidden from the public site.
  publishedAt: z.iso.datetime({ offset: true, message: "publishedAt must be an ISO 8601 date" }).nullable(),
};

/** POST: a new article. Leaving out publishedAt publishes it now. */
export const articleInputSchema = z.object({
  ...fields,
  body: fields.body.default(""),
  publishedAt: fields.publishedAt.optional(),
});
export type ArticleInput = z.infer<typeof articleInputSchema>;

/** PATCH: any subset of the fields. */
export const articlePatchSchema = z.object(fields).partial();
export type ArticlePatch = z.infer<typeof articlePatchSchema>;

/** PUT /api/v1/admin/articles/order: every article id, in the order the site shows them. */
export const articleOrderSchema = z.object({
  ids: z.array(z.number().int().positive()).min(1).max(1000)
    .refine((ids) => new Set(ids).size === ids.length, "Each article may appear only once"),
});

/** GET /api/v1/articles?limit= (the home page shows 4). */
export const articleQuerySchema = z.object({
  limit: z.coerce.number().int().catch(100).transform((n) => Math.min(Math.max(n, 1), 100)).default(100),
});
