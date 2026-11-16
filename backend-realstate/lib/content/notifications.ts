import { z } from "zod";
import { prisma } from "@/lib/prisma";

// Where the website emails a copy of every new message (enquiry, callback request, contact form):
// Admin → Contact & Services → "Send new-message emails to". Stored in SiteSetting "notifications".
// PRIVATE: never part of GET /api/v1/site (that only returns the public keys); the admin reads it
// with GET /api/v1/admin/site/notifications. Empty = the public business email (contact.email).

export const notificationsSchema = z.object({
  email: z.string().trim().toLowerCase().max(254)
    .refine((v) => v === "" || z.email().safeParse(v).success, "That email address doesn't look right"),
});
export type Notifications = z.infer<typeof notificationsSchema>;

const KEY = "notifications";

export async function loadNotifications(): Promise<Notifications> {
  const row = await prisma.siteSetting.findUnique({ where: { key: KEY }, select: { value: true } });
  const parsed = notificationsSchema.safeParse(row?.value);
  return parsed.success ? parsed.data : { email: "" };
}

export async function saveNotifications(v: Notifications): Promise<Notifications> {
  await prisma.siteSetting.upsert({ where: { key: KEY }, create: { key: KEY, value: v }, update: { value: v } });
  return v;
}
