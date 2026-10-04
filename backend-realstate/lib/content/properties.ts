import { Prisma, type ListingType } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { HttpError } from "@/lib/auth/guards";
import { isDistrict } from "@/lib/content/districts";
import { loadOptions, RAPD_UNIT, type OptionKey } from "@/lib/content/options";
import { formatArea, formatLand, formatPrice, formatRoad, landSqft, normalizeRapd, rapdProblem, type ListingLabel } from "@/lib/content/format";
import { gridFromCoords, inNepal, resolveMapLink, shiftedCentre, type LatLng } from "@/lib/content/geo";
import { formatNbId, lowestFreeNumber, nbIdHolder, parseNbId } from "@/lib/content/nb-id";
import type { PropertyInput, PropertyPatch, PropertyQuery } from "@/lib/validation/property";
import { deleteUnusedMedia } from "@/lib/storage/media";

// Properties: turning rows into the frontend's shape, checking admin input, and the queries behind
// /api/v1/properties (public) and /api/v1/admin/properties (admin).
//
// PRIVACY: googleMapsUrl and the real latitude / longitude are ADMIN-ONLY. Public output has one
// point, `approx`: the real point when the admin chose "exact", otherwise the stored shifted centre.

const INCLUDE = {
  location: true,
  amenities: { include: { amenity: { select: { name: true, position: true } } } },
} satisfies Prisma.PropertyInclude;
type PropertyRow = Prisma.PropertyGetPayload<{ include: typeof INCLUDE }>;

const LISTING_LABEL: Record<ListingType, ListingLabel> = { FOR_SALE: "For Sale", FOR_RENT: "For Rent" };
const num = (d: Prisma.Decimal | null | undefined): number | null => (d === null || d === undefined ? null : Number(d));
const point = (lat: Prisma.Decimal | null | undefined, lng: Prisma.Decimal | null | undefined): LatLng | null =>
  lat != null && lng != null ? { lat: Number(lat), lng: Number(lng) } : null;

export type PlanBox = { id: string; name: string; area: number; x: number; y: number; w: number; h: number };

/** What visitors get: the frontend's `Prop` shape, plus the structured values behind its strings. */
export type PublicProperty = {
  id: number; nbId: string; listing: ListingLabel; type: string; badge: string;
  title: string; tagline: string; description: string; featured: boolean; verified: boolean;
  price: string; priceNum: number | null;
  beds: number; baths: number; floors: number; buildYear: number;
  builtArea: string; landArea: string; landAreaSqft: number | null; roadAccess: string; facing: string;
  hero: string; gallery: string[]; videoUrl: string | null;
  features: string[]; amenities: string[]; highlights: string[];
  location: string; district: string; mapX: number; mapY: number;
  approx: LatLng | null; locationMode: "exact" | "approximate";
  floorPlan: PlanBox[] | null; reactionCount: number; createdAt: string; updatedAt: string;
};

/** The admin also gets the private location and the values exactly as the editor sends them. */
export type AdminProperty = PublicProperty & {
  deletedAt: string | null;
  mapUrl: string | null;
  exact: LatLng | null;
  edit: PropertyInput;
};

function planBoxes(value: Prisma.JsonValue): PlanBox[] | null {
  return Array.isArray(value) ? (value as unknown as PlanBox[]) : null;
}

export function toPublic(row: PropertyRow): PublicProperty {
  const listing = LISTING_LABEL[row.listing];
  const loc = row.location;
  const amenities = [...row.amenities].sort((a, b) => a.amenity.position - b.amenity.position).map((a) => a.amenity.name);
  const exactMode = loc?.locationMode === "EXACT";
  const approx = exactMode ? point(loc?.latitude, loc?.longitude) : point(loc?.approxLatitude, loc?.approxLongitude);
  const price = row.price === null ? null : Number(row.price);
  return {
    id: row.id,
    nbId: formatNbId(row.listing, row.nbNumber),
    listing,
    type: row.type,
    badge: row.badge ?? "",
    title: row.title,
    tagline: row.tagline,
    description: row.description,
    featured: row.featured,
    verified: row.verified,
    price: formatPrice(price, listing),
    priceNum: price,
    // The frontend's "not applicable" is 0 / "—".
    beds: row.bedrooms ?? 0,
    baths: row.bathrooms ?? 0,
    floors: row.floors ?? 0,
    buildYear: row.buildYear ?? 0,
    builtArea: formatArea(num(row.builtAreaValue), row.builtAreaUnit),
    landArea: formatLand(num(row.landAreaValue), row.landAreaUnit, row.landAreaRapd),
    landAreaSqft: row.landAreaSqft,
    roadAccess: formatRoad(row.roadSurface, row.roadWidthFt),
    facing: row.facing ?? "",
    hero: row.gallery[0] ?? "",
    gallery: row.gallery,
    videoUrl: row.videoUrl,
    features: [...row.highlights, ...amenities],
    amenities,
    highlights: row.highlights,
    location: loc?.address || loc?.district || "",
    district: loc?.district ?? "",
    mapX: loc?.mapX ?? 50,
    mapY: loc?.mapY ?? 50,
    approx,
    locationMode: exactMode ? "exact" : "approximate",
    floorPlan: planBoxes(row.floorPlan),
    reactionCount: row.reactionCount,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toAdmin(row: PropertyRow): AdminProperty {
  const loc = row.location;
  const builtValue = num(row.builtAreaValue), landValue = num(row.landAreaValue);
  return {
    ...toPublic(row),
    deletedAt: row.deletedAt?.toISOString() ?? null,
    mapUrl: loc?.googleMapsUrl ?? null,
    exact: point(loc?.latitude, loc?.longitude),
    edit: {
      nbId: formatNbId(row.listing, row.nbNumber),
      title: row.title, tagline: row.tagline, description: row.description, type: row.type, badge: row.badge,
      featured: row.featured, verified: row.verified, price: row.price === null ? null : Number(row.price),
      bedrooms: row.bedrooms, bathrooms: row.bathrooms, floors: row.floors, buildYear: row.buildYear,
      builtArea: builtValue !== null && row.builtAreaUnit ? { value: builtValue, unit: row.builtAreaUnit } : null,
      landArea: row.landAreaRapd ? { rapd: row.landAreaRapd }
        : landValue !== null && row.landAreaUnit ? { value: landValue, unit: row.landAreaUnit } : null,
      facing: row.facing, roadSurface: row.roadSurface, roadWidthFt: row.roadWidthFt,
      gallery: row.gallery, videoUrl: row.videoUrl,
      amenities: [...row.amenities].sort((a, b) => a.amenity.position - b.amenity.position).map((a) => a.amenity.name),
      highlights: row.highlights, floorPlan: planBoxes(row.floorPlan), reactionCount: row.reactionCount,
      location: {
        district: loc?.district ?? "", address: loc?.address ?? "", mapUrl: loc?.googleMapsUrl ?? null,
        locationMode: loc?.locationMode === "EXACT" ? "exact" : "approximate",
      },
    },
  };
}

// ─── Checking admin input ──────────────────────────────────────────────────────

const invalid = (field: string, message: string): HttpError =>
  new HttpError(400, "VALIDATION_FAILED", message, { [field]: message });

function refTaken(nbId: string, holder: { title: string }): HttpError {
  const message = `#${nbId} is already used by “${holder.title}”`;
  return new HttpError(409, "REF_TAKEN", message, { nbId: message });
}

/** The database rejected a duplicate NB ID (two saves racing each other). */
const isUniqueViolation = (e: unknown): boolean =>
  typeof e === "object" && e !== null && "code" in e && (e as { code: unknown }).code === "P2002";

type Resolved = {
  listing: ListingType; nbNumber: number;
  builtArea: { value: number; unit: string } | null;
  land: { value: number | null; unit: string | null; rapd: string | null; sqft: number | null };
  amenityIds: number[];
};

/** Checks the values that depend on the database: option lists, district, amenities, units. */
async function resolveInput(v: PropertyInput): Promise<Resolved> {
  const nb = parseNbId(v.nbId);
  if (!nb) throw invalid("nbId", "The NB ID must be NBS (for sale) or NBL (for rent) followed by a number, e.g. NBS005");

  const options = await loadOptions();
  const check = (field: string, value: string | null, key: OptionKey, label: string): void => {
    if (value !== null && !options[key].includes(value)) throw invalid(field, `“${value}” is not one of the ${label} (Admin → Dropdown Options)`);
  };
  check("type", v.type, "propertyTypes", "property types");
  check("badge", v.badge, "badges", "badges");
  check("facing", v.facing, "facings", "facings");
  check("roadSurface", v.roadSurface, "roadSurfaces", "road surfaces");
  if (v.builtArea) check("builtArea", v.builtArea.unit, "builtUnits", "built area units");
  if (!isDistrict(v.location.district)) throw invalid("location.district", `“${v.location.district}” is not one of Nepal's 77 districts`);

  let land: Resolved["land"] = { value: null, unit: null, rapd: null, sqft: null };
  if (v.landArea && "rapd" in v.landArea) {
    const problem = rapdProblem(v.landArea.rapd);
    if (problem) throw invalid("landArea", problem);
    const rapd = normalizeRapd(v.landArea.rapd);
    land = { value: null, unit: RAPD_UNIT, rapd, sqft: landSqft(null, null, rapd) };
  } else if (v.landArea) {
    if (v.landArea.unit !== RAPD_UNIT) check("landArea", v.landArea.unit, "landUnits", "land area units");
    land = { value: v.landArea.value, unit: v.landArea.unit, rapd: null, sqft: landSqft(v.landArea.value, v.landArea.unit, null) };
  }

  const names = [...new Set(v.amenities)];
  const found = names.length ? await prisma.amenity.findMany({ where: { name: { in: names } }, select: { id: true, name: true } }) : [];
  const unknown = names.filter((n) => !found.some((a) => a.name === n));
  if (unknown.length) throw invalid("amenities", `Unknown amenities: ${unknown.join(", ")}`);

  return { listing: nb.listing, nbNumber: nb.nbNumber, builtArea: v.builtArea, land, amenityIds: found.map((a) => a.id) };
}

type LocationData = {
  district: string; address: string; googleMapsUrl: string | null; locationMode: "EXACT" | "APPROXIMATE";
  latitude: number | null; longitude: number | null; approxLatitude: number | null; approxLongitude: number | null;
  mapX: number; mapY: number;
};

/**
 * The stored location. The link is only resolved again when it changed; the shifted centre is only
 * made again when the real point changed (so reloading or re-saving can't reveal it).
 */
async function resolveLocation(
  loc: PropertyInput["location"],
  saved: PropertyRow["location"] | null,
  warnings: string[],
): Promise<LocationData> {
  const url = loc.mapUrl?.trim() || null;
  let exact: LatLng | null;
  if (!url) exact = null;
  else if (saved && saved.googleMapsUrl === url) exact = point(saved.latitude, saved.longitude);
  else {
    const r = await resolveMapLink(url);
    exact = r.point;
    if (r.warning) warnings.push(r.warning);
  }
  if (exact && !inNepal(exact)) warnings.push("The pin is outside Nepal. Check the Google Maps link.");

  const savedExact = saved ? point(saved.latitude, saved.longitude) : null;
  const savedApprox = saved ? point(saved.approxLatitude, saved.approxLongitude) : null;
  const sameExact = exact && savedExact && exact.lat === savedExact.lat && exact.lng === savedExact.lng;
  const approx = exact ? (sameExact && savedApprox ? savedApprox : shiftedCentre(exact)) : null;
  const mode = loc.locationMode === "exact" ? "EXACT" : "APPROXIMATE";
  // The decorative Buy / Rent grid uses the point visitors may see.
  const shown = mode === "EXACT" ? exact : approx;
  return {
    district: loc.district, address: loc.address, googleMapsUrl: url, locationMode: mode,
    latitude: exact?.lat ?? null, longitude: exact?.lng ?? null,
    approxLatitude: approx?.lat ?? null, approxLongitude: approx?.lng ?? null,
    ...(shown ? gridFromCoords(shown) : { mapX: saved?.mapX ?? 50, mapY: saved?.mapY ?? 50 }),
  };
}

function propertyData(v: PropertyInput, r: Resolved) {
  return {
    nbNumber: r.nbNumber, listing: r.listing,
    title: v.title, tagline: v.tagline, description: v.description, type: v.type, badge: v.badge,
    featured: v.featured, verified: v.verified, price: v.price === null ? null : BigInt(v.price),
    bedrooms: v.bedrooms, bathrooms: v.bathrooms, floors: v.floors, buildYear: v.buildYear,
    builtAreaValue: r.builtArea?.value ?? null, builtAreaUnit: r.builtArea?.unit ?? null,
    landAreaValue: r.land.value, landAreaUnit: r.land.unit, landAreaRapd: r.land.rapd, landAreaSqft: r.land.sqft,
    facing: v.facing, roadSurface: v.roadSurface, roadWidthFt: v.roadWidthFt,
    gallery: v.gallery, videoUrl: v.videoUrl, highlights: v.highlights,
    floorPlan: v.floorPlan ?? Prisma.JsonNull, reactionCount: v.reactionCount,
  };
}

// ─── Admin: create, update, delete, restore ─────────────────────────────────────

export type SaveResult = { property: AdminProperty; warnings: string[] };

export async function createProperty(v: PropertyInput): Promise<SaveResult> {
  const r = await resolveInput(v);
  const warnings: string[] = [];
  const location = await resolveLocation(v.location, null, warnings);
  try {
    const row = await prisma.$transaction(async (tx) => {
      const holder = await nbIdHolder(tx, r.listing, r.nbNumber);
      if (holder) throw refTaken(formatNbId(r.listing, r.nbNumber), holder);
      return tx.property.create({
        data: {
          ...propertyData(v, r),
          location: { create: location },
          amenities: { create: r.amenityIds.map((amenityId) => ({ amenityId })) },
        },
        include: INCLUDE,
      });
    });
    return { property: toAdmin(row), warnings };
  } catch (e) {
    if (isUniqueViolation(e)) throw refTaken(formatNbId(r.listing, r.nbNumber), { title: "another property" });
    throw e;
  }
}

async function findLive(id: number): Promise<PropertyRow> {
  const row = await prisma.property.findFirst({ where: { id, deletedAt: null }, include: INCLUDE });
  if (!row) throw new HttpError(404, "NOT_FOUND", "Property not found");
  return row;
}

/** PATCH: the saved property with the sent fields on top, checked as a whole. */
export async function updateProperty(id: number, patch: PropertyPatch): Promise<SaveResult> {
  const saved = await findLive(id);
  const current = toAdmin(saved).edit;
  const merged: PropertyInput = { ...current, ...patch, location: { ...current.location, ...patch.location } };
  const r = await resolveInput(merged);
  const warnings: string[] = [];
  const location = await resolveLocation(merged.location, saved.location, warnings);
  try {
    const row = await prisma.$transaction(async (tx) => {
      const holder = await nbIdHolder(tx, r.listing, r.nbNumber, id);
      if (holder) throw refTaken(formatNbId(r.listing, r.nbNumber), holder);
      if (patch.amenities) await tx.propertyAmenity.deleteMany({ where: { propertyId: id } });
      return tx.property.update({
        where: { id },
        data: {
          ...propertyData(merged, r),
          location: { upsert: { create: location, update: location } },
          ...(patch.amenities ? { amenities: { create: r.amenityIds.map((amenityId) => ({ amenityId })) } } : {}),
        },
        include: INCLUDE,
      });
    });
    // Photos / video taken off this property: delete their files unless another property uses them.
    const kept = new Set([...row.gallery, ...(row.videoUrl ? [row.videoUrl] : [])]);
    await deleteUnusedMedia([...saved.gallery, ...(saved.videoUrl ? [saved.videoUrl] : [])].filter((u) => !kept.has(u)));
    return { property: toAdmin(row), warnings };
  } catch (e) {
    if (isUniqueViolation(e)) throw refTaken(formatNbId(r.listing, r.nbNumber), { title: "another property" });
    throw e;
  }
}

/**
 * How long a deleted property can still be restored (the admin's Undo is shown for 7 s). After
 * that the row is removed for good; its location, amenity links, likes and reviews go with it
 * (onDelete: Cascade), and messages / free listings that pointed at it keep their text (SetNull).
 */
export const UNDO_WINDOW_MS = 60_000;

/** Permanently removes every property deleted longer ago than the undo window. */
export async function purgeDeletedProperties(): Promise<number> {
  const expired = await prisma.property.findMany({
    where: { deletedAt: { lt: new Date(Date.now() - UNDO_WINDOW_MS) } },
    select: { id: true, gallery: true, videoUrl: true },
  });
  if (!expired.length) return 0;
  const done = await prisma.property.deleteMany({ where: { id: { in: expired.map((p) => p.id) }, deletedAt: { not: null } } });
  await deleteUnusedMedia(expired.flatMap((p) => [...p.gallery, ...(p.videoUrl ? [p.videoUrl] : [])]));
  return done.count;
}

/**
 * Delete: hidden everywhere and the NB ID freed at once; restorable (Undo) for UNDO_WINDOW_MS, then
 * removed from the database. A timer does it on a long-running server; purgeDeletedProperties() on
 * the next delete or admin list catches any the timer missed (restart, serverless).
 */
export async function deleteProperty(id: number): Promise<void> {
  const done = await prisma.property.updateMany({ where: { id, deletedAt: null }, data: { deletedAt: new Date() } });
  if (done.count === 0) throw new HttpError(404, "NOT_FOUND", "Property not found");
  await purgeDeletedProperties();
  setTimeout(() => { purgeDeletedProperties().catch((e) => console.error("Purging deleted properties failed", e)); }, UNDO_WINDOW_MS + 1000).unref?.();
}

/**
 * Undo a delete. The NB ID is kept if it is still free; otherwise the property gets the lowest free
 * number of its sequence, and `nbIdChanged` says so.
 */
export async function restoreProperty(id: number): Promise<{ property: AdminProperty; nbIdChanged: boolean }> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const row = await prisma.property.findUnique({ where: { id }, include: INCLUDE });
    if (!row) throw new HttpError(404, "NOT_FOUND", "This property was deleted for good and can't be restored");
    if (!row.deletedAt) throw new HttpError(409, "CONFLICT", "This property is not deleted");
    if (row.deletedAt.getTime() < Date.now() - UNDO_WINDOW_MS) {
      await purgeDeletedProperties();
      throw new HttpError(404, "NOT_FOUND", "This property was deleted for good and can't be restored");
    }
    const taken = await nbIdHolder(prisma, row.listing, row.nbNumber, id);
    const nbNumber = taken ? await lowestFreeNumber(prisma, row.listing, id) : row.nbNumber;
    try {
      const back = await prisma.property.update({ where: { id }, data: { deletedAt: null, nbNumber }, include: INCLUDE });
      return { property: toAdmin(back), nbIdChanged: nbNumber !== row.nbNumber };
    } catch (e) {
      if (!isUniqueViolation(e)) throw e;   // someone took that number a moment ago: look again
    }
  }
  throw new HttpError(409, "REF_TAKEN", "Could not find a free NB ID. Try again.");
}

export async function getAdminProperty(id: number): Promise<AdminProperty> {
  const row = await prisma.property.findUnique({ where: { id }, include: INCLUDE });
  if (!row) throw new HttpError(404, "NOT_FOUND", "Property not found");
  return toAdmin(row);
}

/** The NB ID the editor pre-fills: the lowest free number of the sequence. */
export async function nextNbId(listing: ListingType, exceptId?: number): Promise<{ nbId: string; nbNumber: number }> {
  const nbNumber = await lowestFreeNumber(prisma, listing, exceptId);
  return { nbId: formatNbId(listing, nbNumber), nbNumber };
}

// ─── Lists (public and admin) ───────────────────────────────────────────────────

/** "for-sale", "sale", "For Sale" → FOR_SALE. */
export function parseListing(value: string | undefined): ListingType | undefined {
  const v = (value ?? "").toLowerCase().replace(/[\s_]+/g, "-");
  if (["for-sale", "sale", "buy"].includes(v)) return "FOR_SALE";
  if (["for-rent", "rent", "letting"].includes(v)) return "FOR_RENT";
  return undefined;
}

function listWhere(q: PropertyQuery): Prisma.PropertyWhereInput {
  const and: Prisma.PropertyWhereInput[] = [{ deletedAt: null }];
  const listing = parseListing(q.listing);
  if (listing) and.push({ listing });
  if (q.type && q.type !== "All Types") and.push({ type: q.type });
  if (q.district && q.district !== "All") and.push({ location: { district: q.district } });
  if (q.minPrice !== undefined || q.maxPrice !== undefined) {
    and.push({ price: { ...(q.minPrice !== undefined ? { gte: BigInt(q.minPrice) } : {}), ...(q.maxPrice !== undefined ? { lte: BigInt(q.maxPrice) } : {}) } });
  }
  if (q.preset === "hot") and.push({ OR: [{ badge: "Hot" }, { featured: true }] });
  if (q.preset === "new") and.push({ badge: { in: ["New", "Prime"] } });
  if (q.q) {
    // A full NB ID finds only that property; anything else searches the text fields.
    const nb = parseNbId(q.q);
    if (nb) and.push({ listing: nb.listing, nbNumber: nb.nbNumber });
    else {
      const contains = { contains: q.q, mode: "insensitive" as const };
      and.push({ OR: [{ title: contains }, { type: contains }, { location: { address: contains } }, { location: { district: contains } }] });
    }
  }
  return { AND: and };
}

const ORDER: Record<PropertyQuery["sort"], Prisma.PropertyOrderByWithRelationInput[]> = {
  newest: [{ createdAt: "desc" }, { id: "desc" }],
  price_asc: [{ price: { sort: "asc", nulls: "last" } }, { id: "desc" }],
  price_desc: [{ price: { sort: "desc", nulls: "last" } }, { id: "desc" }],
  reactions: [{ reactionCount: "desc" }, { id: "desc" }],
};

export type Page<T> = { data: T[]; meta: { page: number; limit: number; total: number; totalPages: number } };

async function list<T>(q: PropertyQuery, map: (row: PropertyRow) => T): Promise<Page<T>> {
  const where = listWhere(q);
  const [total, rows] = await prisma.$transaction([
    prisma.property.count({ where }),
    prisma.property.findMany({ where, include: INCLUDE, orderBy: ORDER[q.sort], skip: (q.page - 1) * q.limit, take: q.limit }),
  ]);
  return { data: rows.map(map), meta: { page: q.page, limit: q.limit, total, totalPages: Math.max(1, Math.ceil(total / q.limit)) } };
}

export const listPublicProperties = (q: PropertyQuery): Promise<Page<PublicProperty>> => list(q, toPublic);
export async function listAdminProperties(q: PropertyQuery): Promise<Page<AdminProperty>> {
  await purgeDeletedProperties();
  return list(q, toAdmin);
}

export async function getPublicProperty(id: number): Promise<PublicProperty> {
  return toPublic(await findLive(id));
}

/** "You may also like": 3 others with the same listing, same district and type first. */
export async function relatedProperties(id: number): Promise<PublicProperty[]> {
  const self = await findLive(id);
  const candidates = await prisma.property.findMany({
    where: { deletedAt: null, listing: self.listing, id: { not: id } },
    include: INCLUDE, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 30,
  });
  const score = (p: PropertyRow): number =>
    (p.location?.district === self.location?.district ? 2 : 0) + (p.type === self.type ? 1 : 0);
  return candidates.sort((a, b) => score(b) - score(a)).slice(0, 3).map(toPublic);
}
