// Free listings: properties sellers submit from the website's Free Listing page. The admin
// reviews each one (Admin → Free Listings), fills the gaps, and publishes it as a normal
// property, or saves it to publish later. The seller's contact details are never published.
//
// For the backend (FRONTEND_CLAUDE.md §7.10):
//   POST  /api/v1/listings                           public: the Free Listing form (multipart photos)
//   GET   /api/v1/admin/listings?status&q&page       ADMIN
//   PATCH /api/v1/admin/listings/:id                 ADMIN { status, draft }  (draft = the edited property)
//   POST  /api/v1/admin/listings/:id/publish         ADMIN: creates the property, returns { propertyId }
//   GET   /api/v1/admin/listings/new-count           ADMIN, polled for the red badge
import { img } from "@/app/components/ui/brand";
import { emitChange } from "./store";
import { makeRef, nextPropRef, nextPropertyId, refNumber, formatPrice, type Listing, type Prop } from "./properties";

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
}

const ago = (hours: number) => new Date(Date.now() - hours * 3_600_000).toISOString();

export const LISTINGS: ListingSubmission[] = [
  { id: 3, receivedAt: ago(3), status: "new", seller: { name: "Hari Prasad Joshi", phone: "9851122334", email: "hari.joshi@example.com" },
    title: "Kirtipur 3-Bedroom House", listing: "For Sale", type: "House/Bungalow", district: "Kathmandu", price: "3,20,00,000",
    builtArea: "2,400 sq.ft", landArea: "0-5-0-0", buildYear: "2018", description: "Three storey house near Tribhuvan University, sunny, with a small garden and parking for two cars.",
    amenities: ["Parking", "Garden", "Boring Water"], photos: [img("photo-1564013799919-ab600027ffc6", 1200, 800), img("photo-1570129477492-45c003edd2be", 1200, 800)] },
  { id: 2, receivedAt: ago(20), status: "new", seller: { name: "Maya Tamang", phone: "9818765432" },
    title: "Flat near Lazimpat", listing: "For Rent", type: "Flat", district: "Kathmandu", price: "45000",
    builtArea: "", landArea: "", buildYear: "", description: "",
    amenities: [], photos: [img("photo-1502672260266-1c1ef2d93688", 1200, 800)] },
  { id: 1, receivedAt: ago(52), status: "draft", seller: { name: "Suresh Bhandari", phone: "9841556677", email: "suresh.b@example.com" },
    title: "Pokhara Land with Lake View", listing: "For Sale", type: "Land", district: "Kaski", price: "1,80,00,000",
    builtArea: "", landArea: "8 Ropani", buildYear: "", description: "Terraced land above Phewa Lake with a clear view of Machhapuchhre. Road up to the plot.",
    amenities: ["Mountain Views"], photos: [img("photo-1500382017468-9049fed747ef", 1200, 800)] },
];

export const newListingsCount = () => LISTINGS.filter(l => l.status === "new").length;

/** From the Free Listing page. API: POST /listings. */
export function addListing(l: Omit<ListingSubmission, "id" | "receivedAt" | "status">): void {
  const id = LISTINGS.reduce((n, x) => Math.max(n, x.id), 0) + 1;
  LISTINGS.unshift({ ...l, id, receivedAt: new Date().toISOString(), status: "new" });
  emitChange();
}

/** API: PATCH /admin/listings/:id. */
export function updateListing(id: number, patch: Partial<ListingSubmission>): void {
  const l = LISTINGS.find(x => x.id === id);
  if (!l) return;
  Object.assign(l, patch);
  emitChange();
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
  const propId = makeRef(l.listing, refNumber(nextPropRef()));
  return {
    id: nextPropertyId(), propId, badge: "New", title: l.title, tagline: "",
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
