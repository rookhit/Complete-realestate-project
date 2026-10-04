// Property reviews and hearts (backend-realstate/app/api/v1/properties/:id/reviews, …/reaction,
// me/reactions, admin/reviews). Posting a review and hearting are SIGNED-IN ONLY.
// Every call goes through authFetch (base URL, bearer token, refresh on 401, ApiError).
import { authFetch } from "@/app/auth";

export type ReviewStatus = "pending" | "published" | "rejected";

/** One review as the API sends it; `date` is ISO 8601, avatar null = initials. */
export type ApiReview = {
  id: number; propertyId: number; author: string; avatar: string | null;
  rating: number; date: string; text: string; verified: boolean; status: ReviewStatus;
};
export type ApiAdminReview = ApiReview & {
  property: { title: string; nbId: string } | null;
  account: { name: string | null; email: string } | null;
};

// ─── Public ─────────────────────────────────────────────────────────────────────

/** Approved reviews of a property, newest first. */
export const fetchReviews = (propertyId: number): Promise<{ data: ApiReview[]; meta: { count: number; average: number } }> =>
  authFetch(`/properties/${propertyId}/reviews`);

/** Post a review; it waits for the admin's approval. */
export const postReview = (propertyId: number, input: { rating: number; text: string }): Promise<{ data: ApiReview }> =>
  authFetch(`/properties/${propertyId}/reviews`, { method: "POST", body: JSON.stringify(input) });

type HeartResult = { data: { liked: boolean; reactionCount: number } };
export const heartProperty = (propertyId: number): Promise<HeartResult> =>
  authFetch(`/properties/${propertyId}/reaction`, { method: "POST", body: "{}" });
export const unheartProperty = (propertyId: number): Promise<HeartResult> =>
  authFetch(`/properties/${propertyId}/reaction`, { method: "DELETE" });

/** The ids of the properties the signed-in user has hearted. */
export const fetchMyHearts = async (): Promise<number[]> => (await authFetch<{ data: number[] }>("/me/reactions")).data;

// ─── Admin ──────────────────────────────────────────────────────────────────────

export const fetchAdminReviews = (): Promise<{ data: ApiAdminReview[]; meta: { total: number; pending: number } }> =>
  authFetch("/admin/reviews");

export const patchReview = (id: number, patch: { status?: ReviewStatus; verified?: boolean }): Promise<{ data: ApiAdminReview }> =>
  authFetch(`/admin/reviews/${id}`, { method: "PATCH", body: JSON.stringify(patch) });

export const deleteReviewOnServer = (id: number): Promise<void> =>
  authFetch(`/admin/reviews/${id}`, { method: "DELETE" });

export const restoreReviewOnServer = (id: number): Promise<{ data: ApiAdminReview }> =>
  authFetch(`/admin/reviews/${id}/restore`, { method: "POST", body: "{}" });
