// Property calls to the backend (backend-realstate/app/api/v1/properties, …/admin/properties).
// Shapes: FRONTEND_CLAUDE.md §0.3. Every call goes through authFetch (base URL, bearer token,
// refresh on 401, the { error } envelope as ApiError).
import { authFetch, publicFetch } from "@/app/auth";
import { type CoverFrame, type Listing, type LocationMode, type PlanBox, type Prop } from "@/app/data/properties";

type Meta = { page: number; limit: number; total: number; totalPages: number };

/** One property as the API sends it (public). */
export type ApiProperty = {
  id: number; nbId: string; listing: Listing; type: string; badge: string;
  title: string; tagline: string; description: string; featured: boolean; verified: boolean;
  price: string; priceNum: number | null;
  /** "per Aana", "per year"…; null = the whole property (sale) / per month (rent). */
  priceUnit?: string | null;
  beds: number; baths: number; floors: number; buildYear: number;
  builtArea: string; landArea: string; landAreaSqft: number | null; roadAccess: string; facing: string;
  hero: string; gallery: string[]; videoUrl: string | null;
  /** The property's videos on social media (empty on the slim card version). */
  videoLinks?: string[];
  features: string[]; amenities: string[]; highlights: string[];
  location: string; district: string; mapX: number; mapY: number;
  approx: { lat: number; lng: number } | null; locationMode: LocationMode;
  floorPlan: PlanBox[] | null; reactionCount: number; createdAt: string; updatedAt: string;
  /** Only sent while it was set for the current cover. */
  coverFrame: CoverFrame | null;
  /**
   * Set on the list's slim card version (view=card): the description is an excerpt, the gallery only the
   * cover, and there are no amenities, floor plan or video. GET /properties/:id has the rest.
   */
  card?: true;
};

/** The admin also gets the private location. */
export type ApiAdminProperty = ApiProperty & {
  deletedAt: string | null; mapUrl: string | null; exact: { lat: number; lng: number } | null;
  /** When it was sold / rented out (hidden from the website); null = on the website. */
  closedAt: string | null;
};

/** What POST / PATCH /admin/properties take (backend-realstate/lib/validation/property.ts). */
export type PropertyInput = {
  nbId: string; title: string; tagline: string; description: string; type: string; badge: string | null;
  featured: boolean; verified: boolean; price: number | null; priceUnit: string | null;
  videoLinks: string[];
  bedrooms: number | null; bathrooms: number | null; floors: number | null; buildYear: number | null;
  builtArea: { value: number; unit: string } | null;
  landArea: { value: number; unit: string } | { rapd: string } | null;
  facing: string | null; roadSurface: string | null; roadWidthFt: number | null;
  // Links (http/https) only; leaving videoUrl out keeps the saved one.
  gallery: string[]; videoUrl?: string | null; amenities: string[]; highlights: string[];
  floorPlan: PlanBox[] | null; reactionCount: number;
  // Leaving it out keeps the saved one; null clears it.
  coverFrame?: CoverFrame | null;
  location: { district: string; address: string; mapUrl: string | null; locationMode: LocationMode };
};

/** The site's `Prop` from an API property. `mapUrl` only exists on admin items. */
export function toProp(p: ApiProperty | ApiAdminProperty): Prop {
  return {
    id: p.id, nbId: p.nbId, badge: p.badge, title: p.title, tagline: p.tagline,
    location: p.location, district: p.district,
    price: p.price, priceNum: p.priceNum ?? 0, priceUnit: p.priceUnit ?? undefined, listing: p.listing, type: p.type,
    videoLinks: p.videoLinks ?? [],
    beds: p.beds, baths: p.baths, builtArea: p.builtArea, landArea: p.landArea,
    roadAccess: p.roadAccess, facing: p.facing, buildYear: p.buildYear, floors: p.floors,
    verified: p.verified, featured: p.featured,
    hero: p.hero, gallery: p.gallery, description: p.description, features: p.features,
    mapX: p.mapX, mapY: p.mapY,
    mapUrl: "mapUrl" in p ? p.mapUrl ?? undefined : undefined,
    closedAt: "closedAt" in p ? p.closedAt ?? undefined : undefined,
    locationMode: p.locationMode,
    approx: p.approx ?? undefined,
    floorPlan: p.floorPlan ?? undefined,
    videoUrl: p.videoUrl ?? undefined,
    coverFrame: p.coverFrame ?? undefined,
    detailed: !p.card,
    updatedAt: p.updatedAt,
  };
}

/**
 * Every live property, 100 a page (the first page says how many pages there are; the rest load side
 * by side). The admin gets the full admin list (with the private location the editor needs). Visitors
 * get the slim card version (view=card), and with `version` (GET /site/version) the edge-cached copy
 * for that version: a change to any property gives a new version, so this is never an older list.
 */
export async function fetchAllProperties(admin: boolean, version?: string): Promise<ApiProperty[]> {
  const query = admin ? "" : `&view=card${version ? `&v=${encodeURIComponent(version)}` : ""}`;
  const url = (page: number) => `${admin ? "/admin/properties" : "/properties"}?limit=100&page=${page}&sort=newest${query}`;
  const get = admin ? authFetch : publicFetch;
  const first = await get<{ data: ApiProperty[]; meta: Meta }>(url(1));
  const rest = await Promise.all(Array.from({ length: Math.max(0, first.meta.totalPages - 1) }, (_, i) =>
    get<{ data: ApiProperty[]; meta: Meta }>(url(i + 2))));
  return [first, ...rest].flatMap(r => r.data);
}

/** One property in full (description, every photo, amenities, floor plan, video), for its own page. */
export async function fetchPropertyDetail(id: number, version?: string): Promise<ApiProperty> {
  return (await publicFetch<{ data: ApiProperty }>(`/properties/${id}${version ? `?v=${encodeURIComponent(version)}` : ""}`)).data;
}

type Saved = { data: ApiAdminProperty; meta?: { warnings?: string[]; nbIdChanged?: boolean } };

export const createProperty = (input: PropertyInput): Promise<Saved> =>
  authFetch<Saved>("/admin/properties", { method: "POST", body: JSON.stringify(input) });

export const updateProperty = (id: number, input: Partial<PropertyInput>): Promise<Saved> =>
  authFetch<Saved>(`/admin/properties/${id}`, { method: "PATCH", body: JSON.stringify(input) });

export const deletePropertyOnServer = (id: number): Promise<void> =>
  authFetch<void>(`/admin/properties/${id}`, { method: "DELETE" });

export const restorePropertyOnServer = (id: number): Promise<Saved> =>
  authFetch<Saved>(`/admin/properties/${id}/restore`, { method: "POST", body: "{}" });

/** Sold / rented out: off the website, kept in Admin → Sold & Rented. */
export const closePropertyOnServer = (id: number): Promise<Saved> =>
  authFetch<Saved>(`/admin/properties/${id}/close`, { method: "POST", body: "{}" });

/** Back on the website. */
export const reopenPropertyOnServer = (id: number): Promise<Saved> =>
  authFetch<Saved>(`/admin/properties/${id}/reopen`, { method: "POST", body: "{}" });

