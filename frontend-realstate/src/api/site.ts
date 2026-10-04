// Site settings (backend-realstate/app/api/v1/site, …/admin/site/:section): home page statistics,
// featured districts, contact details and services. Reading is public; saving is admin only.
import { authFetch } from "@/app/auth";
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
