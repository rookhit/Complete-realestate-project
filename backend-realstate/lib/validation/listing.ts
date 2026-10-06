import { z } from "zod";
import { isUploadedPhoto } from "@/lib/storage/r2";

// Free listings: the seller's form (signed-in only) and the admin's review.

const text = (max: number) => z.string().trim().max(max, `At most ${max} characters`);
// Only URLs from POST /listings/uploads: an outside link would make the admin's browser load it.
const photo = z.string().trim().max(2000).refine((url) => isUploadedPhoto(url, "listings"), "Photos must be uploaded");

/** POST /api/v1/listings — what the seller typed, as typed. */
export const listingInputSchema = z.object({
  sellerName: text(80).min(2, "Please fill in your name"),
  sellerPhone: text(30).regex(/^\+?[\d\s()-]{6,30}$/, "Check the phone number"),
  sellerEmail: z.union([z.literal("").transform(() => null), text(254).toLowerCase().pipe(z.email("Check the email address"))]).nullable().default(null),
  title: text(120).min(3, "Please fill in the property title"),
  listing: z.enum(["For Sale", "For Rent"]),
  type: text(60).min(1),
  district: text(60).min(1, "Please choose a district"),
  price: text(60).default(""),
  builtArea: text(60).default(""),
  landArea: text(60).default(""),
  buildYear: text(10).default(""),
  description: text(5000).default(""),
  amenities: z.array(text(60).min(1)).max(100).default([]),
  photos: z.array(photo).min(1, "Please add at least one photo").max(20, "At most 20 photos"),
});
export type ListingInput = z.infer<typeof listingInputSchema>;

/** POST /api/v1/listings/uploads — a signed upload link for one of the seller's photos. */
export const listingUploadSchema = z.object({
  contentType: z.string().trim().toLowerCase().min(1).max(100),
  size: z.number().int().positive("The file is empty"),
});

/** PATCH /api/v1/admin/listings/:id — status changes, the admin's saved draft, the published property. */
export const listingPatchSchema = z.object({
  status: z.enum(["new", "draft", "published", "rejected"]),
  // The admin's edited property (the frontend's Prop), kept by "Save for later". null clears it.
  draft: z.record(z.string(), z.unknown()).nullable(),
  // Set when the admin publishes it as a property.
  propertyId: z.number().int().positive().nullable(),
}).partial().refine((v) => Object.keys(v).length > 0, "Nothing to change");
export type ListingPatch = z.infer<typeof listingPatchSchema>;
