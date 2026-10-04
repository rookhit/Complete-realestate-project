// Free listings: properties signed-in sellers submit from the website's Free Listing page. The
// admin reviews each one (Admin → Free Listings), fills the gaps, and publishes it as a normal
// property, or saves it to publish later. The seller's contact details are never published.
//
// Stored in the database (backend-realstate/lib/content/listings.ts, src/api/listings.ts). The
// form posts straight to the API; LISTINGS is the admin's copy: loadListings() fills it (polled
// with the inbox), and updateListing() shows a change at once and saves it.
import { fetchListings, patchListing } from "@/api/listings";
import { ApiError } from "@/app/auth";
import { emitChange } from "./store";
import { nextPropRef, nextPropertyId, formatPrice, type Listing, type Prop } from "./properties";

export type ListingStatus = "new" | "draft" | "published" | "rejected";
export const LISTING_STATUS: Record<ListingStatus, string> = { new: "New", draft: "Saved for later", published: "Published", rejected: "Rejected" };

/** What the seller typed on the Free Listing page, as they typed it. */
export interface ListingSubmission {
  id: number;
  receivedAt: string;            // ISO 8601
  status: ListingStatus;
  seller: { name: string; phone: string; email?: string };   // private: never published
  title: string;
  listing: Listing;
  type: string;
  district: string;
  price: string;                 // as typed, e.g. "5,00,00,000"
  builtArea: string;             // as typed, e.g. "3,500 sq.ft"
  landArea: string;              // as typed, e.g. "8 Ropani" or "4-4-0-1"
  buildYear: string;
  description: string;
  amenities: string[];
  photos: string[];
  draft?: Prop;                  // the admin's edited version, kept by "Save for later"
  propertyId?: number;           // set once published
  statusBeforeReject?: ListingStatus;   // so Restore puts it back exactly where it was
  account?: { name: string | null; email: string } | null;   // the signed-in account that sent it
}

/** Every listing, newest first. Empty until an admin signs in. */
export const LISTINGS: ListingSubmission[] = [];
let loadRun = 0;
/** Listings with a save on its way: a refresh that started before it finished must not undo it. */
const saving = new Map<number, number>();

/** Fill LISTINGS from the API (admin only). A failure keeps what is there. */
export async function loadListings(): Promise<void> {
  const run = ++loadRun;
  try {
    const list = await fetchListings();
    if (run !== loadRun) return;
    // Keep this screen's version of any listing that is still being saved.
    const next = list.map(l => (saving.has(l.id) ? LISTINGS.find(x => x.id === l.id) ?? l : l));
    LISTINGS.splice(0, LISTINGS.length, ...next);
    emitChange();
  } catch { /* try again on the next poll */ }
}

/** Signed out: forget the admin's list. */
export function clearListings(): void {
  loadRun++;
  if (LISTINGS.length) { LISTINGS.splice(0); emitChange(); }
}

export const newListingsCount = () => LISTINGS.filter(l => l.status === "new").length;

const saveFailedListeners = new Set<(message: string) => void>();
/** Called with a message when a change could not be saved (the listing has then gone back). */
export function onListingSaveFailed(f: (message: string) => void): () => void {
  saveFailedListeners.add(f);
  return () => { saveFailedListeners.delete(f); };
}

/**
 * Change a listing: shown at once, then saved (PATCH /admin/listings/:id: status, draft,
 * propertyId). If the server refuses, it goes back to what was there and the admin is told.
 */
export function updateListing(id: number, patch: Partial<ListingSubmission>): void {
  const l = LISTINGS.find(x => x.id === id);
  if (!l) return;
  const before = { ...l };
  Object.assign(l, patch);
  emitChange();
  const body: { status?: ListingStatus; draft?: Prop | null; propertyId?: number | null } = {};
  if (patch.status !== undefined) body.status = patch.status;
  if ("draft" in patch) body.draft = patch.draft ?? null;
  if ("propertyId" in patch) body.propertyId = patch.propertyId ?? null;
  if (!Object.keys(body).length) return;
  // The list may have been refreshed meanwhile: apply the answer to whatever is shown now.
  const current = () => LISTINGS.find(x => x.id === id);
  saving.set(id, (saving.get(id) ?? 0) + 1);
  patchListing(id, body).then(
    res => { const c = current(); if (c) Object.assign(c, res.data); emitChange(); },
    err => {
      const c = current(); if (c) Object.assign(c, before);
      emitChange();
      const why = err instanceof ApiError ? err.message : "Check the connection and try again.";
      saveFailedListeners.forEach(f => f(`“${l.title}” could not be saved: ${why}`));
    },
  ).finally(() => {
    const n = (saving.get(id) ?? 1) - 1;
    if (n > 0) saving.set(id, n); else saving.delete(id);
  });
}

/** "5,00,00,000" → 50000000; "85 lakh" and "1.2 crore" are understood too. */
export function priceFromText(text: string): number {
  const t = text.toLowerCase().replace(/,/g, "");
  const n = parseFloat(t.replace(/[^\d.]/g, "")) || 0;
  if (/cr/.test(t)) return Math.round(n * 10_000_000);
  if (/lakh|lac|\bl\b/.test(t)) return Math.round(n * 100_000);
  return Math.round(n);
}

/** "8 Ropani", "4-4-0-1", "2400" → the site's landArea format. */
function landFromText(text: string): string {
  const t = text.trim();
  if (!t) return "—";
  if (/^\d+(-\d+){1,3}$/.test(t)) { const p = t.split("-").map(Number); while (p.length < 4) p.push(0); return `${p.join("-")} R-A-P-D`; }
  return /^\d[\d,.]*$/.test(t) ? `${t} Ropani` : t;
}

/**
 * The submission as a property, ready for the editor: every field the seller gave, with
 * the rest left for the admin to fill (the editor shows what is missing). A saved draft
 * wins over the original submission.
 */
export function listingToProp(l: ListingSubmission): Prop {
  if (l.draft) return l.draft;
  const priceNum = priceFromText(l.price);
  const isLand = l.type === "Land";
  // The lowest free NB ID in the seller's sequence (NBS for sale, NBL for rent); editable in the review.
  const nbId = nextPropRef(l.listing);
  return {
    id: nextPropertyId(), nbId, badge: "New", title: l.title, tagline: "",
    location: l.district, district: l.district, price: priceNum ? formatPrice(priceNum, l.listing) : "", priceNum,
    listing: l.listing, type: l.type || "House/Bungalow",
    beds: 0, baths: 0, builtArea: isLand || !l.builtArea.trim() ? "—" : l.builtArea.trim(), landArea: landFromText(l.landArea),
    roadAccess: "", facing: "North", buildYear: Number(l.buildYear) || 0, floors: 0,
    verified: false, featured: false,
    hero: l.photos[0] ?? "", gallery: [...l.photos], description: l.description, features: [...l.amenities],
    mapX: 50, mapY: 50,
  };
}

/**
 * What is missing, in plain words. `required` blocks publishing (the property editor asks for
 * the same things); `recommended` makes a better listing but can be skipped.
 */
export function listingGaps(l: ListingSubmission): { required: string[]; recommended: string[] } {
  const p = listingToProp(l);
  const pick = (xs: (string | false)[]) => xs.filter((x): x is string => !!x);
  return {
    required: pick([
      p.title.trim().length < 3 && "title", !p.district && "district", !p.priceNum && "price",
      p.gallery.length === 0 && "photos", p.description.trim().length < 20 && "description",
    ]),
    recommended: pick([
      p.type !== "Land" && !p.beds && "bedrooms", p.landArea === "—" && p.builtArea === "—" && "area",
      !p.roadAccess && "road access", !p.tagline && "tagline",
    ]),
  };
}
