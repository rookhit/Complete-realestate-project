// Property reviews and reaction counts (mock data). API in FRONTEND_CLAUDE.md §7.7:
//   GET  /api/v1/properties/:id/reviews   newest first
//   POST /api/v1/properties/:id/reviews   { rating, name, text } -> moderation queue
// "verified" must be set by the server, never taken from the client.
// reactionCount should not include the caller's own heart; the frontend adds it locally.
// (Testimonials about the agency are separate, in data/content.ts.)
import { img } from "@/app/components/ui/brand";
import { emitChange } from "./store";

export interface Review {
  id:       number;
  author:   string;
  avatar:   string;
  rating:   number;   // 1-5, whole stars
  date:     string;   // display string for now; the API should send ISO 8601
  text:     string;
  verified: boolean;  // the reviewer actually visited through us
}

/** How many people have reacted to each property, keyed by property id. */
export const REACTIONS: Record<number, number> = {
  1: 184, 2: 126, 3: 97, 4: 71, 5: 58, 6: 143,
  7: 89, 8: 112, 9: 64, 10: 155, 11: 78, 12: 131,
};

const REVIEW_POOL: Review[] = [
  { id:1, author:"Sushmita Rana", avatar:img("photo-1487412720507-e7ab37603c6f",120,120), rating:5, date:"May 2025", verified:true,
    text:"We viewed this property twice before deciding. The finish quality is genuinely what the photographs suggest, which is rarer than it should be. Natural light through the afternoon is the thing that sold us." },
  { id:2, author:"Prakash Adhikari", avatar:img("photo-1519085360753-af0119f7cbe7",120,120), rating:5, date:"Apr 2025", verified:true,
    text:"Straightforward viewing, no pressure from the agent, and every document we asked for arrived the same day. The neighbourhood is quiet after 8pm which was our main concern." },
  { id:3, author:"Anjana Maharjan", avatar:img("photo-1438761681033-6461ffad8d80",120,120), rating:4, date:"Apr 2025", verified:true,
    text:"Beautiful space and the water supply is reliable, which matters more here than people admit. Marked it four only because parking is tighter than the listing implies for a larger vehicle." },
  { id:4, author:"Deepak Tamang", avatar:img("photo-1500648767791-00dcc994a43e",120,120), rating:5, date:"Mar 2025", verified:false,
    text:"Visited during the monsoon deliberately to check drainage and there was no pooling anywhere on the approach. That told me more than any brochure." },
  { id:5, author:"Rita Shakya", avatar:img("photo-1544005313-94ddf0286df2",120,120), rating:5, date:"Mar 2025", verified:true,
    text:"The build feels solid. We had our own engineer inspect the structure and he had nothing of substance to flag, which he almost never says." },
  { id:6, author:"Nabin Karki", avatar:img("photo-1506794778202-cad84cf45f1d",120,120), rating:4, date:"Feb 2025", verified:true,
    text:"Excellent location for anyone commuting into the centre. Morning traffic on the main road carries a little noise to the front rooms, though the rear is completely still." },
  { id:7, author:"Sabina Thapa", avatar:img("photo-1534528741775-53994a69daeb",120,120), rating:5, date:"Feb 2025", verified:true,
    text:"Nepal Bhoomi arranged the viewing around my schedule and answered the ownership questions properly instead of deflecting. The property itself exceeded what I expected at this price." },
  { id:8, author:"Hari Gurung", avatar:img("photo-1507591064344-4c6ce005b128",120,120), rating:5, date:"Jan 2025", verified:false,
    text:"Spacious, well finished and the views are not exaggerated. Worth seeing in person before comparing it with anything else in the area." },
];

/**
 * Which reviews belong to which property: a rotating slice of the pool, so
 * every listing has a plausible history. Replaced wholesale by the API.
 * Each entry is a copy with its own id (property id × 100 + position), so
 * deleting a review on one property never touches another.
 */
const REVIEWS: Record<number, Review[]> = Object.fromEntries(
  Array.from({ length: 12 }, (_, i) => {
    const id = i + 1, take = [5,4,3,5,4,6,3,4,5,6,3,4][i];
    return [id, Array.from({ length: take }, (_, k) => ({ ...REVIEW_POOL[(i*3+k) % REVIEW_POOL.length], id: id * 100 + k + 1 }))];
  }),
);

export const reviewsFor = (id: number): Review[] => REVIEWS[id] ?? [];

/** Every property id that has at least one review, for the admin Reviews page. */
export const reviewedPropertyIds = (): number[] =>
  Object.keys(REVIEWS).map(Number).filter(id => REVIEWS[id].length > 0);

/** API: DELETE /api/v1/admin/reviews/:reviewId (ADMIN). */
export function deleteReview(propertyId: number, reviewId: number): void {
  const list = REVIEWS[propertyId];
  if (!list) return;
  const i = list.findIndex(r => r.id === reviewId);
  if (i >= 0) { list.splice(i, 1); emitChange(); }
}

/** Undo for deleteReview: put the review back at its old position. */
export function restoreReview(propertyId: number, review: Review, index: number): void {
  const list = (REVIEWS[propertyId] ??= []);
  if (list.some(r => r.id === review.id)) return;
  list.splice(Math.min(Math.max(index, 0), list.length), 0, review);
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

/** Average star rating to one decimal place, or 0 when there are no reviews. */
export const ratingFor = (id: number): number => {
  const r = reviewsFor(id);
  if (!r.length) return 0;
  return +(r.reduce((a, b) => a + b.rating, 0) / r.length).toFixed(1);
};

/** Stored count plus one if this visitor has reacted. */
export const reactionCount = (id: number, mine: boolean): number =>
  (REACTIONS[id] ?? 0) + (mine ? 1 : 0);
