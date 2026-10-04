// Property reviews and hearts, from the database (src/api/reviews.ts).
//
// Reviews: signed-in users post them; they wait as "pending" until the admin approves them in
// Admin → Reviews, and only approved ones are public. "verified" (Verified Visit) is set by the
// admin. A property page loads its reviews with loadReviews(); the admin's list is ADMIN_REVIEWS.
//
// Hearts: REACTIONS is each property's shown count (it includes every heart, the signed-in
// user's too, plus whatever the admin set). MY_HEARTS is what the server says this user hearted.
// (Testimonials about the agency are separate, in data/content.ts.)
import {
  deleteReviewOnServer, fetchAdminReviews, fetchMyHearts, fetchReviews, patchReview, restoreReviewOnServer,
  type ApiAdminReview, type ApiReview, type ReviewStatus,
} from "@/api/reviews";
import { emitChange } from "./store";

export interface Review {
  id:       number;
  author:   string;
  avatar?:  string;   // no photo: the site shows initials
  rating:   number;   // 1-5, whole stars
  date:     string;   // "May 2025" (the API sends ISO 8601)
  text:     string;
  verified: boolean;  // the reviewer actually visited through us (set by the admin)
}

/** A review as the admin sees it: its status, property and the account that wrote it. */
export interface AdminReview extends Review {
  propertyId: number;
  status: ReviewStatus;
  property: { title: string; nbId: string } | null;
  account: { name: string | null; email: string } | null;
  dateIso: string;
}

const monthOf = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { month: "short", year: "numeric" });

function toReview(r: ApiReview): Review {
  return { id: r.id, author: r.author, ...(r.avatar ? { avatar: r.avatar } : {}), rating: r.rating, date: monthOf(r.date), text: r.text, verified: r.verified };
}
function toAdminReview(r: ApiAdminReview): AdminReview {
  return { ...toReview(r), propertyId: r.propertyId, status: r.status, property: r.property, account: r.account, dateIso: r.date };
}

// ─── Hearts ─────────────────────────────────────────────────────────────────────

/** Each property's shown heart count, keyed by property id (filled with the properties). */
export const REACTIONS: Record<number, number> = {};

/** The properties the signed-in user has hearted, as the server last confirmed. */
export const MY_HEARTS = new Set<number>();

/** On sign-in: which properties this user has hearted. */
export async function loadMyHearts(): Promise<void> {
  try {
    const ids = await fetchMyHearts();
    MY_HEARTS.clear();
    ids.forEach(id => MY_HEARTS.add(id));
    emitChange();
  } catch { /* signed out or offline: nothing shows as hearted */ }
}

/** On sign-out: forget the previous user's hearts. */
export function clearMyHearts(): void {
  if (MY_HEARTS.size) { MY_HEARTS.clear(); emitChange(); }
}

/** The server's answer to a heart / un-heart: the new count and whether it is hearted. */
export function applyHeart(propertyId: number, liked: boolean, reactionCount: number): void {
  REACTIONS[propertyId] = reactionCount;
  if (liked) MY_HEARTS.add(propertyId); else MY_HEARTS.delete(propertyId);
  emitChange();
}

/**
 * Set how many reactions a property shows. The admin can raise or lower it.
 * API: PATCH /api/v1/admin/properties/:id with { reactionCount } (ADMIN).
 */
export function setReactionCount(propertyId: number, count: number): void {
  REACTIONS[propertyId] = Math.max(0, Math.round(count));
  emitChange();
}

/** The count to show while `mine` may differ from what the server has (a heart on its way). */
export const reactionCount = (id: number, mine: boolean): number =>
  Math.max(0, (REACTIONS[id] ?? 0) - (MY_HEARTS.has(id) ? 1 : 0) + (mine ? 1 : 0));

// ─── Public reviews ─────────────────────────────────────────────────────────────

/** Approved reviews by property id, filled by loadReviews(). */
const REVIEWS: Record<number, Review[]> = {};
const inFlight = new Map<number, Promise<void>>();

/** Load a property's approved reviews (one request at a time per property). */
export function loadReviews(propertyId: number): Promise<void> {
  const running = inFlight.get(propertyId);
  if (running) return running;
  const run = fetchReviews(propertyId)
    .then(res => { REVIEWS[propertyId] = res.data.map(toReview); emitChange(); })
    .catch(() => { /* offline: the page shows no reviews */ })
    .finally(() => inFlight.delete(propertyId));
  inFlight.set(propertyId, run);
  return run;
}

export const reviewsFor = (id: number): Review[] => REVIEWS[id] ?? [];

/** Average star rating to one decimal place, or 0 when there are no reviews. */
export const ratingFor = (id: number): number => {
  const r = reviewsFor(id);
  if (!r.length) return 0;
  return +(r.reduce((a, b) => a + b.rating, 0) / r.length).toFixed(1);
};

// ─── Admin ──────────────────────────────────────────────────────────────────────

/** Every review (any status), newest first. Empty until an admin signs in. */
export const ADMIN_REVIEWS: AdminReview[] = [];

/** Fill ADMIN_REVIEWS (admin only; polled with the inbox). A failure keeps what is there. */
export async function loadAdminReviews(): Promise<void> {
  try {
    const res = await fetchAdminReviews();
    ADMIN_REVIEWS.splice(0, ADMIN_REVIEWS.length, ...res.data.map(toAdminReview));
    emitChange();
  } catch { /* try again on the next poll */ }
}

export function clearAdminReviews(): void {
  if (ADMIN_REVIEWS.length) { ADMIN_REVIEWS.splice(0); emitChange(); }
}

export const pendingReviewCount = () => ADMIN_REVIEWS.filter(r => r.status === "pending").length;

/** Approve / reject / mark verified, then update the list from what the server stored. */
export async function updateReview(id: number, patch: { status?: ReviewStatus; verified?: boolean }): Promise<void> {
  const { data } = await patchReview(id, patch);
  const i = ADMIN_REVIEWS.findIndex(r => r.id === id);
  if (i >= 0) ADMIN_REVIEWS[i] = toAdminReview(data);
  delete REVIEWS[data.propertyId];   // the public list changes with approval: load it again when shown
  emitChange();
}

/** Delete on the server, then here. Resolves to where it was, for Undo. */
export async function deleteReview(id: number): Promise<number> {
  await deleteReviewOnServer(id);
  const i = ADMIN_REVIEWS.findIndex(r => r.id === id);
  if (i >= 0) {
    delete REVIEWS[ADMIN_REVIEWS[i].propertyId];
    ADMIN_REVIEWS.splice(i, 1);
    emitChange();
  }
  return i;
}

/** Undo a delete (the server keeps it for a minute). */
export async function restoreReview(review: AdminReview, index: number): Promise<void> {
  const { data } = await restoreReviewOnServer(review.id);
  if (ADMIN_REVIEWS.some(r => r.id === review.id)) return;
  ADMIN_REVIEWS.splice(Math.min(Math.max(index, 0), ADMIN_REVIEWS.length), 0, toAdminReview(data));
  delete REVIEWS[data.propertyId];
  emitChange();
}
