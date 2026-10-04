import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { isDistrict } from "@/lib/content/districts";
import { deleteUnusedMedia } from "@/lib/storage/media";

// Site settings the admin edits (Admin → Home Page, Contact & Services), stored in SiteSetting:
//   "stats"             the four figures in the home page's dark band
//   "featuredDistricts" the district photo tiles ("Prestige Properties Across Nepal"); the site
//                       counts each district's properties itself
//   "contact"           phone, email, WhatsApp, address, hours, social links (footer, Contact page…)
//   "services"          the services list (home, About and Services pages), in order
// GET /api/v1/site returns the saved ones; a setting never saved is left out and the site keeps
// its own defaults (frontend-realstate/src/app/data/content.ts).

const text = (max: number) => z.string().trim().max(max, `At most ${max} characters`);
const https = z.union([z.literal(""), z.string().trim().max(500).regex(/^https?:\/\/\S+$/i, "Links must start with https://")]);

export const statsSchema = z.object({
  items: z.array(z.object({
    value: text(12).min(1, "Every figure needs a value, e.g. 180+"),
    label: text(30).min(1, "Every figure needs a label"),
  })).min(1, "Keep at least one figure").max(8, "At most 8 figures"),
});

export const MAX_FEATURED_DISTRICTS = 5;
export const featuredDistrictsSchema = z.object({
  items: z.array(z.object({
    name: text(60).refine(isDistrict, "Choose one of Nepal's 77 districts"),
    img: z.string().trim().max(2000).regex(/^https?:\/\/\S+$/i, "Every district needs an uploaded photo"),
  })).min(1, "Keep at least one district").max(MAX_FEATURED_DISTRICTS, `At most ${MAX_FEATURED_DISTRICTS} districts`)
    .refine((l) => new Set(l.map((d) => d.name)).size === l.length, "Each district can appear only once"),
});

export const contactSchema = z.object({
  address: text(300),
  phone: text(40).min(6, "Enter the phone number"),
  whatsapp: text(40).refine((v) => v.replace(/\D/g, "").length >= 10, "Enter the WhatsApp number with its country code, e.g. +977 98…"),
  email: text(254).toLowerCase().pipe(z.email("That email address doesn't look right")),
  hours: text(300),
  instagram: https, facebook: https, youtube: https, linkedin: https,
});

export const SERVICE_ICONS = ["home", "key", "briefcase", "award", "building", "landmark", "scale", "hammer", "compass", "chart", "shield", "handshake"] as const;
export const servicesSchema = z.object({
  items: z.array(z.object({
    icon: z.enum(SERVICE_ICONS, "Choose an icon from the list"),
    title: text(60).min(1, "Every service needs a title"),
    desc: text(400).min(1, "Every service needs a description"),
  })).min(1, "Keep at least one service").max(24, "At most 24 services"),
});

type Stat = { id: number; value: string; label: string };
type District = { id: number; name: string; img: string };
type Service = { id: number; icon: (typeof SERVICE_ICONS)[number]; title: string; desc: string };
export type Contact = z.infer<typeof contactSchema>;
export type SiteSettings = { stats?: Stat[]; featuredDistricts?: District[]; contact?: Contact; services?: Service[] };

const KEYS = ["stats", "featuredDistricts", "contact", "services"] as const;

/** Every setting the admin has saved (one query). */
export async function loadSite(): Promise<SiteSettings> {
  const rows = await prisma.siteSetting.findMany({ where: { key: { in: [...KEYS] } }, select: { key: true, value: true } });
  return Object.fromEntries(rows.map((r) => [r.key, r.value])) as SiteSettings;
}

async function save<T>(key: (typeof KEYS)[number], value: T): Promise<T> {
  await prisma.siteSetting.upsert({ where: { key }, create: { key, value: value as object }, update: { value: value as object } });
  return value;
}

/** Ids are the position (1, 2, …): the frontend only uses them as list keys. */
const withIds = <T extends object>(items: T[]): (T & { id: number })[] => items.map((x, i) => ({ id: i + 1, ...x }));

export const saveStats = (v: z.infer<typeof statsSchema>): Promise<Stat[]> => save("stats", withIds(v.items));
export const saveContact = (v: Contact): Promise<Contact> => save("contact", v);
export const saveServices = (v: z.infer<typeof servicesSchema>): Promise<Service[]> => save("services", withIds(v.items));

/** Saves the district tiles; photos no longer used by any tile (or anything else) are deleted. */
export async function saveFeaturedDistricts(v: z.infer<typeof featuredDistrictsSchema>): Promise<District[]> {
  const before = (await loadSite()).featuredDistricts ?? [];
  const saved = await save("featuredDistricts", withIds(v.items));
  const kept = new Set(saved.map((d) => d.img));
  await deleteUnusedMedia(before.map((d) => d.img).filter((u) => !kept.has(u)));
  return saved;
}
