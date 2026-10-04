import { z } from "zod";

// What the admin's team editor sends to POST / PATCH /api/v1/admin/team. Everything but the name
// and role is optional; an empty string counts as "not given" (stored as null / []).

const text = (max: number) => z.string().trim().max(max, `At most ${max} characters`);
/** Optional text: "" and null both mean "not given". */
const optional = (max: number) => text(max).nullable().transform((v) => (v ? v : null));
const tags = (label: string) => z.array(text(40).min(1)).max(20, `At most 20 ${label}`)
  .transform((list) => [...new Set(list)]);

const fields = {
  name: text(60).min(2, "Enter their name"),
  role: text(60).min(1, "Choose their role"),
  // An uploaded portrait (http/https). Optional: the site shows initials without one.
  photoUrl: z.string().trim().max(2000, "Photo link is too long")
    .regex(/^https?:\/\/\S+$/i, "The photo must be an uploaded image (a link starting with https://)")
    .nullable().or(z.literal("").transform(() => null)),
  department: optional(60),
  bio: optional(1000),
  experienceYears: z.number().int().min(0).max(80).nullable().transform((v) => (v ? v : null)),
  specialities: tags("specialities"),
  languages: tags("languages"),
  phone: optional(30).refine((v) => v === null || /^\+?[\d\s()-]{6,30}$/.test(v), "Check the phone number"),
  // Digits with the country code, e.g. 9779800000000 (spaces and + are removed).
  whatsapp: text(30).nullable().transform((v) => (v ? v.replace(/\D/g, "") || null : null))
    .refine((v) => v === null || /^\d{8,15}$/.test(v), "WhatsApp needs the country code, e.g. 977 98…"),
  email: optional(254).refine((v) => v === null || z.email().safeParse(v).success, "Check the email address")
    .transform((v) => v?.toLowerCase() ?? null),
};

/** POST: a new member. Leaving out an optional field = not given. */
export const teamInputSchema = z.object({
  ...fields,
  photoUrl: fields.photoUrl.default(null),
  department: fields.department.default(null),
  bio: fields.bio.default(null),
  experienceYears: fields.experienceYears.default(null),
  specialities: fields.specialities.default([]),
  languages: fields.languages.default([]),
  phone: fields.phone.default(null),
  whatsapp: fields.whatsapp.default(null),
  email: fields.email.default(null),
});
export type TeamInput = z.infer<typeof teamInputSchema>;

/** PATCH: any subset of the fields. */
export const teamPatchSchema = z.object(fields).partial();
export type TeamPatch = z.infer<typeof teamPatchSchema>;

/** PUT /api/v1/admin/team/order: every member id, in the order the site shows them. */
export const teamOrderSchema = z.object({
  ids: z.array(z.number().int().positive()).min(1).max(1000)
    .refine((ids) => new Set(ids).size === ids.length, "Each member may appear only once"),
});
