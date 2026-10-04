import { z } from "zod";

/** POST /api/v1/properties/:id/reviews — the name and photo come from the account, never the body. */
export const reviewInputSchema = z.object({
  rating: z.number().int().min(1, "Please choose a star rating").max(5, "Ratings are 1 to 5 stars"),
  text: z.string().trim().min(20, "Please write at least a couple of sentences").max(3000, "At most 3000 characters"),
});
export type ReviewInput = z.infer<typeof reviewInputSchema>;

/** GET /api/v1/admin/reviews?status=pending|published|rejected&propertyId */
export const reviewQuerySchema = z.object({
  status: z.enum(["pending", "published", "rejected"]).optional().catch(undefined),
  propertyId: z.coerce.number().int().positive().optional().catch(undefined),
});
export type ReviewQuery = z.infer<typeof reviewQuerySchema>;

/** PATCH /api/v1/admin/reviews/:id — approve / reject, and the "Verified Visit" mark (admin only). */
export const reviewPatchSchema = z.object({
  status: z.enum(["pending", "published", "rejected"]),
  verified: z.boolean(),
}).partial().refine((v) => v.status !== undefined || v.verified !== undefined, "Send status and/or verified");
export type ReviewPatch = z.infer<typeof reviewPatchSchema>;
