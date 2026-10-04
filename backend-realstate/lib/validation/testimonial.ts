import { z } from "zod";

// What the admin's testimonial editor sends to POST / PATCH /api/v1/admin/testimonials.

const text = (max: number) => z.string().trim().max(max, `At most ${max} characters`);

const fields = {
  name: text(60).min(2, "Enter the client's name"),
  // Who they are, e.g. "Property Buyer, Kathmandu". Optional.
  role: text(60),
  rating: z.number().int().min(1, "Rating is 1 to 5 stars").max(5, "Rating is 1 to 5 stars"),
  text: text(1000).min(20, "Write what they said (a sentence or two)"),
  // An uploaded photo (http/https). Optional: the site shows initials without one. "" = none.
  photoUrl: z.string().trim().max(2000, "Photo link is too long")
    .regex(/^https?:\/\/\S+$/i, "The photo must be an uploaded image (a link starting with https://)")
    .nullable().or(z.literal("").transform(() => null)),
};

/** POST: a new testimonial. */
export const testimonialInputSchema = z.object({
  ...fields,
  role: fields.role.default(""),
  rating: fields.rating.default(5),
  photoUrl: fields.photoUrl.default(null),
});
export type TestimonialInput = z.infer<typeof testimonialInputSchema>;

/** PATCH: any subset of the fields. */
export const testimonialPatchSchema = z.object(fields).partial();
export type TestimonialPatch = z.infer<typeof testimonialPatchSchema>;

/** PUT /api/v1/admin/testimonials/order: every testimonial id, in the order the site shows them. */
export const testimonialOrderSchema = z.object({
  ids: z.array(z.number().int().positive()).min(1).max(1000)
    .refine((ids) => new Set(ids).size === ids.length, "Each testimonial may appear only once"),
});
