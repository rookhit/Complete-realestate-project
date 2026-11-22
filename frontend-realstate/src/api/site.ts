// Site settings (backend-realstate/app/api/v1/site, …/admin/site/:section): home page statistics,
// featured districts, contact details and services. Reading is public; saving is admin only.
import { authFetch, publicFetch } from "@/app/auth";
import type { ContactInfo, FeaturedDistrict, Service, Stat } from "@/app/data/content";

/** The settings the admin has saved; one never saved is left out (the site keeps its default). */
export type SavedSite = { stats?: Stat[]; featuredDistricts?: FeaturedDistrict[]; contact?: ContactInfo; services?: Service[] };

export async function fetchSite(): Promise<SavedSite> {
  return (await authFetch<{ data: SavedSite }>("/site")).data;
}

const put = async <T,>(section: string, body: unknown): Promise<T> =>
  (await authFetch<{ data: T }>(`/admin/site/${section}`, { method: "PUT", body: JSON.stringify(body) })).data;

export const saveSiteStats = (items: Pick<Stat, "value" | "label">[]): Promise<Stat[]> => put("stats", { items });
export const saveSiteDistricts = (items: Pick<FeaturedDistrict, "name" | "img">[]): Promise<FeaturedDistrict[]> => put("featured-districts", { items });
export const saveSiteContact = (contact: ContactInfo): Promise<ContactInfo> => put("contact", contact);
export const saveSiteServices = (items: Pick<Service, "icon" | "title" | "desc">[]): Promise<Service[]> => put("services", { items });

/**
 * The mark stamped on property photos before they upload (backend lib/content/watermark.ts): a
 * see-through band across the middle with the text and / or logo. `logo` is a PNG / WebP data: URL
 * or ""; `opacity` = how dark the band is (10-90 %); `size` = its height (6-30 % of the photo).
 */
export type Watermark = { enabled: boolean; text: string; logo: string; opacity: number; size: number };

/** Public: sellers' browsers stamp their free-listing photos too. Kept out of GET /site (the logo). */
export async function fetchWatermark(): Promise<Watermark> {
  return (await authFetch<{ data: Watermark }>("/site/watermark")).data;
}
export const saveSiteWatermark = (w: Watermark): Promise<Watermark> => put("watermark", w);

/**
 * Where the website emails a copy of every new message (enquiry, callback request, contact form).
 * "" = the public business email (contact.email). Admin only: it is not part of GET /site.
 */
export type Notifications = { email: string };
export async function fetchNotifications(): Promise<Notifications> {
  return (await authFetch<{ data: Notifications }>("/admin/site/notifications")).data;
}
export const saveSiteNotifications = (n: Notifications): Promise<Notifications> => put("notifications", n);

/**
 * The data version (backend lib/content/version.ts): changes whenever the property or article lists
 * change. The lists are then fetched with ?v=<version>, so they come from the edge cache yet are never
 * older than the latest change. Cached at the edge for 2 s.
 */
export type DataVersion = { properties: string; articles: string };
export async function fetchDataVersion(): Promise<DataVersion> {
  return (await publicFetch<{ data: DataVersion }>("/site/version")).data;
}
