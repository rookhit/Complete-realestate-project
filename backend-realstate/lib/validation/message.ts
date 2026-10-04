import { z } from "zod";

// The website forms (signed-in users only) and the admin's Messages inbox.

const text = (max: number) => z.string().trim().max(max, `At most ${max} characters`);
const name = text(80).min(2, "Please enter your name");
const email = text(254).toLowerCase().pipe(z.email("Check the email address"));
const phone = text(30).regex(/^\+?[\d\s()-]{6,30}$/, "Check the phone number");
/** Optional field: "" means not given. */
const optional = <T extends z.ZodType<string>>(schema: T) => z.union([z.literal("").transform(() => null), schema]).nullable().default(null);

/** POST /api/v1/enquiries — "Enquire About This Property" on a property page. */
export const enquirySchema = z.object({
  propertyId: z.number().int().positive(),
  name,
  email: optional(email),
  phone: optional(phone),
  message: text(5000).default(""),
}).refine((v) => v.email || v.phone, { message: "Please add an email or a phone number", path: ["email"] });
export type EnquiryInput = z.infer<typeof enquirySchema>;

/** POST /api/v1/callbacks — "Request a Callback" (Let Us Call You). */
export const callbackSchema = z.object({
  name,
  phone,
  // When to call, e.g. "Evening (4pm-6pm)".
  time: text(60).min(1, "Choose a time"),
});
export type CallbackInput = z.infer<typeof callbackSchema>;

/** POST /api/v1/contact — the Contact Us page. */
export const contactSchema = z.object({
  name,
  email,
  phone: optional(phone),
  // The "Interest" dropdown, e.g. "Buy Property".
  topic: text(60).min(1, "Choose what it is about"),
  message: text(5000).default(""),
});
export type ContactInput = z.infer<typeof contactSchema>;

// Bad or missing → the fallback; too big → capped.
const intParam = (fallback: number, max: number) =>
  z.coerce.number().int().catch(fallback).transform((n) => Math.min(Math.max(n, 1), max));

/** GET /api/v1/admin/messages?kind&unread&q&page&limit */
export const messageQuerySchema = z.object({
  kind: z.enum(["enquiry", "callback", "contact", "email"]).optional().catch(undefined),
  unread: z.enum(["true", "1"]).optional().catch(undefined),
  q: z.string().trim().max(100).optional(),
  page: intParam(1, 10_000).default(1),
  limit: intParam(50, 200).default(50),
});
export type MessageQuery = z.infer<typeof messageQuerySchema>;

/** PATCH /api/v1/admin/messages/:id */
export const messagePatchSchema = z.object({ read: z.boolean(), replied: z.boolean() }).partial()
  .refine((v) => v.read !== undefined || v.replied !== undefined, "Send read and/or replied");
export type MessagePatch = z.infer<typeof messagePatchSchema>;
