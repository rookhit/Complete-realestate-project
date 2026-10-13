import { z } from "zod";

// What the admin editor sends to POST / PATCH /api/v1/admin/properties. The listing (For Sale /
// For Rent) comes from the NB ID prefix, so the two can never disagree. Values from the editable
// dropdown lists (type, badge, facing, road surface, units), the district and the amenity names are
// checked against the database in lib/content/properties.ts, not here.

const text = (max: number) => z.string().trim().max(max, `At most ${max} characters`);
const count = z.number().int().min(0).max(999);

// Images and videos: a link the admin pastes (http/https). Cloudflare R2 uploads will produce these
// URLs later. blob: links only work in the tab that made them, so they are refused.
const media = z.string().trim().min(1).max(2000, "Media link is too long")
  .regex(/^https?:\/\/\S+$/i, "Use a full link starting with https://");

const planBox = z.object({
  id: text(64).min(1),
  name: text(40),
  area: z.number().min(0).max(1_000_000),
  x: z.number().min(0).max(100),
  y: z.number().min(0).max(100),
  w: z.number().min(0).max(100),
  h: z.number().min(0).max(100),
});

// Every field, without defaults. PATCH uses these as-is (only what is sent is changed); POST adds
// the defaults below.
const locationFields = {
  district: text(60).min(1, "Choose the district"),
  address: text(200),
  // The Google Maps link as pasted; null clears it (no map).
  mapUrl: text(2000).nullable(),
  locationMode: z.enum(["approximate", "exact"]),
};

const fields = {
  nbId: z.string().trim().min(1, "Give the property an NB ID").max(20),
  title: text(200).min(3, "Give the property a title"),
  tagline: text(120),
  description: text(10_000),
  type: text(60).min(1, "Choose the property type"),
  badge: text(40).nullable(),
  featured: z.boolean(),
  verified: z.boolean(),
  // Whole rupees (per month for rent). null = no price given, shown as "Negotiable".
  price: z.number().int().positive("Price must be above 0").max(1e15).nullable(),
  bedrooms: count.nullable(),
  bathrooms: count.nullable(),
  floors: count.nullable(),
  buildYear: z.number().int().min(1800).max(2200).nullable(),
  builtArea: z.object({ value: z.number().positive().max(1e9), unit: text(20).min(1) }).nullable(),
  // Either a number + unit ({ value: 12, unit: "Ropani" }) or Ropani-Aana-Paisa-Dam ({ rapd: "4-4-0-1" }).
  landArea: z.union([
    z.object({ value: z.number().positive().max(1e9), unit: text(20).min(1) }),
    z.object({ rapd: text(40).min(1) }),
  ]).nullable(),
  facing: text(40).nullable(),
  roadSurface: text(40).nullable(),
  roadWidthFt: z.number().int().min(0).max(1000).nullable(),
  gallery: z.array(media).max(30, "At most 30 photos"),
  videoUrl: media.nullable(),
  amenities: z.array(text(60).min(1)).max(100),
  highlights: z.array(text(80).min(1)).max(30),
  floorPlan: z.array(planBox).max(40).nullable(),
  reactionCount: z.number().int().min(0).max(10_000_000),
};

/** POST: a full property; anything left out gets its default. */
export const propertyInputSchema = z.object({
  ...fields,
  tagline: fields.tagline.default(""),
  description: fields.description.default(""),
  badge: fields.badge.default(null),
  featured: fields.featured.default(false),
  verified: fields.verified.default(false),
  price: fields.price.default(null),
  bedrooms: fields.bedrooms.default(null),
  bathrooms: fields.bathrooms.default(null),
  floors: fields.floors.default(null),
  buildYear: fields.buildYear.default(null),
  builtArea: fields.builtArea.default(null),
  landArea: fields.landArea.default(null),
  facing: fields.facing.default(null),
  roadSurface: fields.roadSurface.default(null),
  roadWidthFt: fields.roadWidthFt.default(null),
  gallery: fields.gallery.default([]),
  videoUrl: fields.videoUrl.default(null),
  amenities: fields.amenities.default([]),
  highlights: fields.highlights.default([]),
  floorPlan: fields.floorPlan.default(null),
  reactionCount: fields.reactionCount.default(0),
  location: z.object({
    ...locationFields,
    address: locationFields.address.default(""),
    mapUrl: locationFields.mapUrl.default(null),
    locationMode: locationFields.locationMode.default("approximate"),
  }),
});
export type PropertyInput = z.infer<typeof propertyInputSchema>;

/** PATCH: any subset of the fields; a `location` object changes only the location fields it carries. */
export const propertyPatchSchema = z.object({ ...fields, location: z.object(locationFields).partial() }).partial();
export type PropertyPatch = z.infer<typeof propertyPatchSchema>;

// Bad or missing → the fallback; too big → capped (limit=500 gives 100).
const intParam = (fallback: number, max: number) =>
  z.coerce.number().int().catch(fallback).transform((n) => Math.min(Math.max(n, 1), max));

/** GET /api/v1/properties and /api/v1/admin/properties query string. */
export const propertyQuerySchema = z.object({
  listing: z.string().optional(),
  type: z.string().optional(),
  district: z.string().optional(),
  minPrice: z.coerce.number().int().min(0).optional().catch(undefined),
  maxPrice: z.coerce.number().int().min(0).optional().catch(undefined),
  preset: z.enum(["hot", "new"]).optional().catch(undefined),
  // Longer searches are cut to 100 characters, not refused.
  q: z.string().trim().transform((s) => s.slice(0, 100)).optional().catch(undefined),
  sort: z.enum(["newest", "price_asc", "price_desc", "reactions"]).catch("newest").default("newest"),
  page: intParam(1, 10_000).default(1),
  limit: intParam(20, 100).default(20),
});
export type PropertyQuery = z.infer<typeof propertyQuerySchema>;
