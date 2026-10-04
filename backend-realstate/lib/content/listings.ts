import { Prisma, type ListingStatus } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { HttpError } from "@/lib/auth/guards";
import { isDistrict } from "@/lib/content/districts";
import type { ListingInput, ListingPatch } from "@/lib/validation/listing";

// Free listings (ListingSubmission): properties signed-in sellers send from the Free Listing page.
// The admin reviews each one (Admin → Free Listings), fills the gaps and publishes it as a normal
// property, saves it for later, or rejects it. The seller's contact details are never published.

const STATUS_OUT: Record<ListingStatus, ListingOut["status"]> = { NEW: "new", DRAFT: "draft", PUBLISHED: "published", REJECTED: "rejected" };
const STATUS_IN: Record<ListingOut["status"], ListingStatus> = { new: "NEW", draft: "DRAFT", published: "PUBLISHED", rejected: "REJECTED" };

/** The frontend's ListingSubmission shape (data/listings.ts), plus the account that sent it. */
export type ListingOut = {
  id: number; receivedAt: string; status: "new" | "draft" | "published" | "rejected";
  seller: { name: string; phone: string; email?: string };
  title: string; listing: "For Sale" | "For Rent"; type: string; district: string;
  price: string; builtArea: string; landArea: string; buildYear: string; description: string;
  amenities: string[]; photos: string[];
  draft?: Record<string, unknown>; propertyId?: number; statusBeforeReject?: ListingOut["status"];
  account: { name: string | null; email: string } | null;
};

const INCLUDE = { user: { select: { name: true, email: true } } } satisfies Prisma.ListingSubmissionInclude;
type ListingRow = Prisma.ListingSubmissionGetPayload<{ include: typeof INCLUDE }>;

function toListing(l: ListingRow): ListingOut {
  return {
    id: l.id, receivedAt: l.receivedAt.toISOString(), status: STATUS_OUT[l.status],
    seller: { name: l.sellerName, phone: l.sellerPhone, ...(l.sellerEmail ? { email: l.sellerEmail } : {}) },
    title: l.title, listing: l.listing === "FOR_RENT" ? "For Rent" : "For Sale", type: l.type, district: l.district,
    price: l.price, builtArea: l.builtArea, landArea: l.landArea, buildYear: l.buildYear, description: l.description,
    amenities: l.amenities, photos: l.photos,
    ...(l.draft && typeof l.draft === "object" && !Array.isArray(l.draft) ? { draft: l.draft as Record<string, unknown> } : {}),
    ...(l.propertyId ? { propertyId: l.propertyId } : {}),
    ...(l.statusBeforeReject ? { statusBeforeReject: STATUS_OUT[l.statusBeforeReject] } : {}),
    account: l.user ? { name: l.user.name, email: l.user.email } : null,
  };
}

/** A signed-in seller's listing: stored as NEW for the admin to review. */
export async function createListing(userId: string, v: ListingInput): Promise<ListingOut> {
  if (!isDistrict(v.district)) throw new HttpError(400, "VALIDATION_FAILED", `“${v.district}” is not one of Nepal's 77 districts`, { district: "Unknown district" });
  // Only known amenity names are kept (the form offers the canonical list).
  const known = v.amenities.length
    ? new Set((await prisma.amenity.findMany({ where: { name: { in: v.amenities } }, select: { name: true } })).map((a) => a.name))
    : new Set<string>();
  const row = await prisma.listingSubmission.create({
    data: {
      userId, sellerName: v.sellerName, sellerPhone: v.sellerPhone, sellerEmail: v.sellerEmail,
      title: v.title, listing: v.listing === "For Rent" ? "FOR_RENT" : "FOR_SALE", type: v.type, district: v.district,
      price: v.price, builtArea: v.builtArea, landArea: v.landArea, buildYear: v.buildYear, description: v.description,
      amenities: [...new Set(v.amenities.filter((a) => known.has(a)))], photos: v.photos,
    },
    include: INCLUDE,
  });
  return toListing(row);
}

/** Every listing, newest first; meta.new = how many wait for a first look (the red badge). */
export async function listListings(): Promise<{ data: ListingOut[]; meta: { total: number; new: number } }> {
  const [rows, fresh] = await prisma.$transaction([
    prisma.listingSubmission.findMany({ include: INCLUDE, orderBy: [{ receivedAt: "desc" }, { id: "desc" }], take: 1000 }),
    prisma.listingSubmission.count({ where: { status: "NEW" } }),
  ]);
  return { data: rows.map(toListing), meta: { total: rows.length, new: fresh } };
}

export async function newListingCount(): Promise<number> {
  return prisma.listingSubmission.count({ where: { status: "NEW" } });
}

/**
 * The admin's changes: status (reject remembers where it was, so Restore can put it back), the
 * saved draft, and the property it was published as.
 */
export async function updateListing(id: number, patch: ListingPatch): Promise<ListingOut> {
  const saved = await prisma.listingSubmission.findUnique({ where: { id } });
  if (!saved) throw new HttpError(404, "NOT_FOUND", "Listing not found");
  if (patch.propertyId) {
    const live = await prisma.property.count({ where: { id: patch.propertyId, deletedAt: null } });
    if (!live) throw new HttpError(400, "VALIDATION_FAILED", "That property doesn't exist", { propertyId: "Unknown property" });
  }
  const status = patch.status ? STATUS_IN[patch.status] : undefined;
  try {
    const row = await prisma.listingSubmission.update({
      where: { id },
      data: {
        ...(status ? { status } : {}),
        // Rejecting remembers the status before; any other status clears it.
        ...(status === "REJECTED" && saved.status !== "REJECTED" ? { statusBeforeReject: saved.status } : status && status !== "REJECTED" ? { statusBeforeReject: null } : {}),
        ...(patch.draft !== undefined ? { draft: patch.draft === null ? Prisma.JsonNull : (patch.draft as Prisma.InputJsonValue) } : {}),
        ...(patch.propertyId !== undefined ? { propertyId: patch.propertyId } : {}),
      },
      include: INCLUDE,
    });
    return toListing(row);
  } catch (e) {
    if (typeof e === "object" && e !== null && (e as { code?: unknown }).code === "P2002") {
      throw new HttpError(409, "CONFLICT", "That property is already linked to another listing");
    }
    throw e;
  }
}
