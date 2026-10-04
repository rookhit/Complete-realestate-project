import { Prisma, type CommentStatus } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { HttpError } from "@/lib/auth/guards";
import { formatNbId } from "@/lib/content/nb-id";
import type { ReviewInput, ReviewPatch, ReviewQuery } from "@/lib/validation/review";

// Property reviews (PropertyComment). Signed-in users post them; they wait as PENDING until the
// admin approves them in Admin → Reviews (decided by the owner, 2026-10-02); only PUBLISHED ones
// are public. The name and photo are copied from the account at posting time. "verified" (the
// "Verified Visit" mark) is set by the admin only, never by the poster.

const STATUS_OUT: Record<CommentStatus, ReviewOut["status"]> = { PENDING: "pending", PUBLISHED: "published", REJECTED: "rejected" };
const STATUS_IN: Record<ReviewOut["status"], CommentStatus> = { pending: "PENDING", published: "PUBLISHED", rejected: "REJECTED" };

/** The frontend's Review shape (data/reviews.ts); `date` is ISO 8601. */
export type ReviewOut = {
  id: number; propertyId: number; author: string; avatar: string | null;
  rating: number; date: string; text: string; verified: boolean;
  status: "pending" | "published" | "rejected";
};
/** The admin also sees which property and account it came from. */
export type AdminReviewOut = ReviewOut & {
  property: { title: string; nbId: string } | null;
  account: { name: string | null; email: string } | null;
};

const ADMIN_INCLUDE = {
  property: { select: { title: true, listing: true, nbNumber: true, deletedAt: true } },
  user: { select: { name: true, email: true } },
} satisfies Prisma.PropertyCommentInclude;
type CommentRow = Prisma.PropertyCommentGetPayload<object>;
type AdminCommentRow = Prisma.PropertyCommentGetPayload<{ include: typeof ADMIN_INCLUDE }>;

function toReview(c: CommentRow): ReviewOut {
  return {
    id: c.id, propertyId: c.propertyId, author: c.authorName, avatar: c.authorAvatarUrl,
    rating: c.rating, date: c.createdAt.toISOString(), text: c.body, verified: c.verified, status: STATUS_OUT[c.status],
  };
}

function toAdminReview(c: AdminCommentRow): AdminReviewOut {
  return {
    ...toReview(c),
    property: c.property && !c.property.deletedAt ? { title: c.property.title, nbId: formatNbId(c.property.listing, c.property.nbNumber) } : null,
    account: c.user ? { name: c.user.name, email: c.user.email } : null,
  };
}

async function liveProperty(id: number): Promise<void> {
  const found = await prisma.property.count({ where: { id, deletedAt: null } });
  if (!found) throw new HttpError(404, "NOT_FOUND", "Property not found");
}

// ─── Public ─────────────────────────────────────────────────────────────────────

/** Approved reviews of one property, newest first, with the count and average (one decimal). */
export async function listPublicReviews(propertyId: number): Promise<{ data: ReviewOut[]; meta: { count: number; average: number } }> {
  await liveProperty(propertyId);
  const rows = await prisma.propertyComment.findMany({
    where: { propertyId, status: "PUBLISHED", deletedAt: null },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
  });
  const average = rows.length ? Math.round((rows.reduce((n, r) => n + r.rating, 0) / rows.length) * 10) / 10 : 0;
  return { data: rows.map(toReview), meta: { count: rows.length, average } };
}

/** A signed-in user's review: stored as PENDING, shown once the admin approves it. */
export async function createReview(userId: string, propertyId: number, v: ReviewInput): Promise<ReviewOut> {
  await liveProperty(propertyId);
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, email: true, oauthAccounts: { select: { pictureUrl: true }, orderBy: { lastLoginAt: "desc" }, take: 1 } },
  });
  if (!user) throw new HttpError(401, "UNAUTHENTICATED", "Login required");
  const row = await prisma.propertyComment.create({
    data: {
      propertyId, userId, rating: v.rating, body: v.text,
      // Shown on the site: the account's name (else the part of the email before @) and its Google photo, if any.
      authorName: user.name?.trim() || user.email.split("@")[0],
      authorAvatarUrl: user.oauthAccounts[0]?.pictureUrl ?? null,
    },
  });
  return toReview(row);
}

// ─── Admin ──────────────────────────────────────────────────────────────────────

/** How long a deleted review can still be restored (Undo), before it is removed for good. */
export const REVIEW_UNDO_WINDOW_MS = 60_000;

export async function purgeDeletedReviews(): Promise<number> {
  const done = await prisma.propertyComment.deleteMany({ where: { deletedAt: { lt: new Date(Date.now() - REVIEW_UNDO_WINDOW_MS) } } });
  return done.count;
}

/** Every review (any status), newest first; `status` and `propertyId` narrow it. */
export async function listAdminReviews(q: ReviewQuery): Promise<{ data: AdminReviewOut[]; meta: { total: number; pending: number } }> {
  await purgeDeletedReviews();
  const where: Prisma.PropertyCommentWhereInput = {
    deletedAt: null,
    ...(q.status ? { status: STATUS_IN[q.status] } : {}),
    ...(q.propertyId ? { propertyId: q.propertyId } : {}),
  };
  const [rows, pending] = await prisma.$transaction([
    prisma.propertyComment.findMany({ where, include: ADMIN_INCLUDE, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 1000 }),
    prisma.propertyComment.count({ where: { deletedAt: null, status: "PENDING" } }),
  ]);
  return { data: rows.map(toAdminReview), meta: { total: rows.length, pending } };
}

export async function updateReview(id: number, patch: ReviewPatch): Promise<AdminReviewOut> {
  const done = await prisma.propertyComment.updateMany({
    where: { id, deletedAt: null },
    data: { ...(patch.status ? { status: STATUS_IN[patch.status] } : {}), ...(patch.verified !== undefined ? { verified: patch.verified } : {}) },
  });
  if (done.count === 0) throw new HttpError(404, "NOT_FOUND", "Review not found");
  return toAdminReview(await prisma.propertyComment.findUniqueOrThrow({ where: { id }, include: ADMIN_INCLUDE }));
}

/** Hidden at once; restorable for REVIEW_UNDO_WINDOW_MS (Undo), then deleted for good. */
export async function deleteReview(id: number): Promise<void> {
  const done = await prisma.propertyComment.updateMany({ where: { id, deletedAt: null }, data: { deletedAt: new Date() } });
  if (done.count === 0) throw new HttpError(404, "NOT_FOUND", "Review not found");
  await purgeDeletedReviews();
  setTimeout(() => { purgeDeletedReviews().catch((e) => console.error("Purging deleted reviews failed", e)); }, REVIEW_UNDO_WINDOW_MS + 1000).unref?.();
}

export async function restoreReview(id: number): Promise<AdminReviewOut> {
  const row = await prisma.propertyComment.findUnique({ where: { id } });
  const gone = new HttpError(404, "NOT_FOUND", "This review was deleted for good and can't be restored");
  if (!row) throw gone;
  if (!row.deletedAt) throw new HttpError(409, "CONFLICT", "This review is not deleted");
  if (row.deletedAt.getTime() < Date.now() - REVIEW_UNDO_WINDOW_MS) { await purgeDeletedReviews(); throw gone; }
  return toAdminReview(await prisma.propertyComment.update({ where: { id }, data: { deletedAt: null }, include: ADMIN_INCLUDE }));
}

/** For the red badge on Admin → Reviews. */
export async function pendingReviewCount(): Promise<number> {
  return prisma.propertyComment.count({ where: { deletedAt: null, status: "PENDING" } });
}
