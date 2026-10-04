// Properties: the shape, the live list loaded from the API, and the dropdown values the admin uses.
// The list comes from GET /api/v1/properties (visitors) or /api/v1/admin/properties (the admin), via
// src/api/properties.ts. The admin's saves go to the API first; the functions at the bottom then
// update this local copy so every page re-renders without reloading.
import { fetchAllProperties, toProp, type ApiProperty } from "@/api/properties";
import { REACTIONS } from "./reviews";
import { emitChange } from "./store";

export type Listing = "For Sale" | "For Rent";

/**
 * One box on a property's floor plan, placed by the admin: a floor (or wing) with its area.
 * x, y, w and h are percentages of the plan, so the plan scales to any screen.
 * Visitors see the name and area when they hover (or, on phones, printed in the box).
 */
export interface PlanBox { id: string; name: string; area: number; x: number; y: number; w: number; h: number }

export type LocationMode = "exact" | "approximate";

export interface Prop {
  id: number; nbId: string; badge: string; title: string; tagline: string;
  location: string; district: string; price: string; priceNum: number;
  listing: Listing; type: string;
  beds: number; baths: number; builtArea: string; landArea: string;
  roadAccess: string; facing: string; buildYear: number; floors: number;
  verified: boolean; featured: boolean;
  hero: string; gallery: string[]; description: string; features: string[];
  mapX: number; mapY: number;
  /** Google Maps link pasted by the admin. ADMIN ONLY: it holds the exact point, so the public API
   *  must not send it. What visitors see depends on locationMode (approxFor() in data/maps.ts). */
  mapUrl?: string;
  /** The admin's choice: "exact" shows the real point on the site; "approximate" (the default)
   *  shows a ~500 m area around a shifted centre, so the house can't be pinpointed. */
  locationMode?: LocationMode;
  /** The point the public API sends instead of mapUrl: the real point when locationMode is
   *  "exact", otherwise the shifted centre of the approximate area. */
  approx?: { lat: number; lng: number };
  /** Added by the admin editor. Properties without it show the illustrative plan. */
  floorPlan?: PlanBox[];
  /** A video link the admin pasted (Cloudflare uploads will fill it later). */
  videoUrl?: string;
}

/**
 * Every live property, loaded from the API (loadProperties below) and kept here so every page can
 * read it synchronously. Empty until the first load finishes; the loading screen waits for it.
 * The 12 old sample listings now live in the database (backend-realstate/prisma/sample-properties.ts).
 */
export const ALL_PROPS: Prop[] = [];

/** Where the first load is: the loading screen waits for "ready" or "error". */
export let propertiesStatus: "loading" | "ready" | "error" = "loading";
export let propertiesError = "";
let loadRun = 0;

/**
 * Fill ALL_PROPS from the API. `admin`: the admin list (adds the private location for the editor).
 * A newer call wins, so switching accounts can't leave an older list on screen.
 */
export async function loadProperties(admin: boolean): Promise<void> {
  const run = ++loadRun;
  try {
    const list = await fetchAllProperties(admin);
    if (run !== loadRun) return;
    ALL_PROPS.splice(0, ALL_PROPS.length, ...list.map(toProp));
    for (const p of list) REACTIONS[p.id] = p.reactionCount;
    propertiesStatus = "ready";
    propertiesError = "";
  } catch (err) {
    if (run !== loadRun) return;
    propertiesStatus = "error";
    propertiesError = err instanceof Error ? err.message : "Could not load the properties.";
  }
  emitChange();
}

/** Put what the API returned after a save into the local list (and its heart count). */
export function applySaved(saved: ApiProperty): Prop {
  const p = toProp(saved);
  REACTIONS[p.id] = saved.reactionCount;
  saveProperty(p);
  return p;
}

export const PROP_TYPES = ["All Types","House/Bungalow","Land","Apartment","Commercial","Flat"];
export const PRICE_RANGES: Record<"For Sale"|"For Rent", {label:string;min:number;max:number}[]> = {
  "For Sale": [
    { label:"Any Price", min:0, max:Infinity },
    { label:"Under 5 Cr", min:0, max:50000000 },
    { label:"5 - 10 Cr", min:50000000, max:100000000 },
    { label:"Above 10 Cr", min:100000000, max:Infinity },
  ],
  "For Rent": [
    { label:"Any Price", min:0, max:Infinity },
    { label:"Under 1 Lakh", min:0, max:100000 },
    { label:"1 - 2 Lakh", min:100000, max:200000 },
    { label:"Above 2 Lakh", min:200000, max:Infinity },
  ],
};

// ─── Vocabulary for the admin dropdowns ───────────────────────────────────────
// Every value below is what gets stored. The API should accept exactly these strings.

export const LISTINGS: Listing[] = ["For Sale", "For Rent"];
/** PROP_TYPES without the "All Types" filter option. */
export const PROPERTY_TYPES = PROP_TYPES.filter(t => t !== "All Types");
export const BADGES = ["Hot", "Featured", "New", "Prime", "Rare", "Verified", "Exclusive"];
export const FACINGS = ["North", "North-East", "East", "South-East", "South", "South-West", "West", "North-West"];
export const ROAD_SURFACES = ["Black-topped", "Concrete", "Graveled", "Earthen"];
/** Nepali land units first, then square feet. */
export const LAND_UNITS = ["Ropani", "Aana", "Bigha", "Kattha", "Dhur", "sq.ft"];
export const BUILT_UNITS = ["sq.ft", "sq.m"];

/**
 * Land written the Nepali way, Ropani-Aana-Paisa-Dam: "4-4-0-1" is 4 ropani, 4 aana, 0 paisa,
 * 1 dam. 1 ropani = 16 aana, 1 aana = 4 paisa, 1 paisa = 4 dam; 1 ropani = 5,476 sq.ft.
 * Stored as "4-4-0-1 R-A-P-D" in `landArea`; the admin types just "4-4-0-1".
 */
export const RAPD = "R-A-P-D";
export const isRapd = (v: string) => /^\d+(-\d+){1,3}$/.test(v.trim());
const rapdParts = (v: string) => { const p = v.trim().split("-").map(Number); while (p.length < 4) p.push(0); return p; };
/** "4-4" → "4-4-0-0", "04-4-0-1" → "4-4-0-1". */
export const normalizeRapd = (v: string) => rapdParts(v).join("-");
/** What is wrong with a typed R-A-P-D value, or null. */
export function rapdProblem(v: string): string | null {
  const [, a, p, d] = rapdParts(v);
  if (a > 15) return "Aana goes up to 15 (16 aana make a ropani).";
  if (p > 3) return "Paisa goes up to 3 (4 paisa make an aana).";
  if (d > 3) return "Dam goes up to 3 (4 dam make a paisa).";
  return null;
}
/** Square feet in an R-A-P-D value, for sorting and filtering by size. */
export function rapdToSqft(v: string): number {
  const [r, a, p, d] = rapdParts(v);
  return Math.round(r * 5476 + a * 342.25 + p * 85.5625 + d * 21.390625);
}
/** "≈ 23,380 sq.ft" for an R-A-P-D landArea, "" for anything else. */
export const landSqftNote = (landArea: string) => { const r = rapdOf(landArea); return r ? `≈ ${rapdToSqft(r).toLocaleString("en-US")} sq.ft` : ""; };
/** The number part of a stored landArea, if it is R-A-P-D ("4-4-0-1 R-A-P-D" → "4-4-0-1"). */
export const rapdOf = (landArea: string) => landArea.match(/^(\d+(?:-\d+){1,3})\s*R-A-P-D$/)?.[1] ?? null;
/** Names offered for new floor-plan boxes, in the order they are usually added. */
export const FLOOR_NAMES = ["Ground Floor", "1st Floor", "2nd Floor", "3rd Floor", "4th Floor", "Basement", "Rooftop"];
/** The box sizes the admin drags onto the plan (percent of the plan's width and height). */
export const PLAN_BOX_SIZES = [
  { key: "s", label: "Small", w: 24, h: 24 },
  { key: "m", label: "Medium", w: 34, h: 34 },
  { key: "l", label: "Large", w: 46, h: 44 },
] as const;
export const planArea = (n: number) => `${n.toLocaleString("en-US")} sq.ft`;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * The display price, from the number in rupees. Matches the seeded strings exactly:
 * 85000000 → "NPR 8.5 Cr", 120000 for rent → "NPR 1.2 L/mo", 85000 for rent → "NPR 85,000/mo".
 */
export function formatPrice(priceNum: number, listing: Listing): string {
  const CR = 10_000_000, LAKH = 100_000;
  const short = (n: number) => String(Math.round(n * 100) / 100);
  const rent = listing === "For Rent";
  let body: string;
  if (priceNum >= CR) body = `${short(priceNum / CR)} Cr`;
  else if (priceNum >= LAKH) body = `${short(priceNum / LAKH)} ${rent ? "L" : "Lakh"}`;
  else body = priceNum.toLocaleString("en-IN");
  return `NPR ${body}${rent ? "/mo" : ""}`;
}

/**
 * A property has two ids:
 * - `id`: the internal number the database generates. Used for links between records; never
 *   shown, never typed, never changes.
 * - `nbId`, the NB ID: the reference the ADMIN gives it. "NBS" + number for a sale, "NBL" +
 *   number for a rental (letting), e.g. "NBS005". Every property has exactly one.
 * Rules (decided 2026-09-30):
 * - NBS and NBL are separate sequences: NBS005 and NBL005 can both exist (two different
 *   properties). The full NB ID is unique among live properties.
 * - The editor pre-fills the lowest free number in the chosen sequence; the admin may type
 *   another free one. Switching sale ↔ rent takes the lowest free number of the other
 *   sequence (editable) and frees the old one.
 * - Deleting frees the number at once; Undo gets it back if it is still free.
 * - Search matches full NB IDs only ("nbs5", "#NBS 005" → NBS005); a bare "005" matches nothing.
 * Stored without the "#"; visitors see "#NBS005" (displayRef).
 */
export const REF_PREFIX: Record<Listing, string> = { "For Sale": "NBS", "For Rent": "NBL" };
export const refNumber = (nbId: string) => Number(nbId.replace(/\D/g, "")) || 0;
export const makeRef = (listing: Listing, n: number) => `${REF_PREFIX[listing]}${String(n).padStart(3, "0")}`;
export const displayRef = (nbId: string) => `#${nbId}`;

/** "#nbs 5", "NBS-005", "nbs005" → "NBS005". Null unless the input is a full NB ID (prefix + number). */
export function parseRef(input: string): string | null {
  const m = input.replace(/[#\s-]/g, "").toUpperCase().match(/^(NB[SL])0*(\d+)$/);
  return m && Number(m[2]) > 0 ? `${m[1]}${m[2].padStart(3, "0")}` : null;
}

/** True when a search is this property's full NB ID, however it is typed. */
export const matchesRef = (nbId: string, query: string): boolean => parseRef(query) === nbId.toUpperCase();

/** The live property already using this NB ID (same sequence, same number), if any. */
export function refTaken(listing: Listing, n: number, exceptId?: number): Prop | null {
  return n > 0 ? ALL_PROPS.find(p => p.id !== exceptId && p.listing === listing && refNumber(p.nbId) === n) ?? null : null;
}

/** Next internal id. The database generates it once the API exists. */
export const nextPropertyId = () => ALL_PROPS.reduce((m, p) => Math.max(m, p.id), 0) + 1;

/**
 * The lowest free NB ID in a sequence (gaps first, e.g. a freed NBL004 before NBL011).
 * `exceptId`: the property being edited, whose own number counts as free.
 * API: GET /admin/properties/next-ref?listing=… → { nbId }.
 */
export function nextPropRef(listing: Listing = "For Sale", exceptId?: number): string {
  let n = 1;
  while (refTaken(listing, n, exceptId)) n++;
  return makeRef(listing, n);
}

/** Create or update. API: POST /admin/properties (new) or PATCH /admin/properties/:id. */
export function saveProperty(p: Prop): void {
  const i = ALL_PROPS.findIndex(x => x.id === p.id);
  if (i >= 0) ALL_PROPS[i] = p; else ALL_PROPS.unshift(p);
  emitChange();
}

/**
 * Put a deleted property back where it was (the admin's Undo). Deleting freed its NB ID, so if
 * another property took that number meanwhile it comes back with the lowest free one instead.
 * Returns the restored property (check its nbId) or null. API: POST /admin/properties/:id/restore.
 */
export function restoreProperty(p: Prop, index: number): Prop | null {
  if (ALL_PROPS.some(x => x.id === p.id)) return null;
  const back = refTaken(p.listing, refNumber(p.nbId), p.id) ? { ...p, nbId: nextPropRef(p.listing, p.id) } : p;
  ALL_PROPS.splice(Math.min(Math.max(index, 0), ALL_PROPS.length), 0, back);
  emitChange();
  return back;
}

/** API: DELETE /admin/properties/:id. The site needs at least one listing, so the last one stays. */
export function deleteProperty(id: number): boolean {
  if (ALL_PROPS.length <= 1) return false;
  const i = ALL_PROPS.findIndex(x => x.id === id);
  if (i < 0) return false;
  ALL_PROPS.splice(i, 1);
  emitChange();
  return true;
}
