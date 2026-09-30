import { useEffect, useState } from "react";
import { Check, Clock, Eye, Heart, History, Lightbulb, Lock, MapPin, Plus, Sparkles, X } from "lucide-react";
import {
  ALL_PROPS, BADGES, BUILT_UNITS, FACINGS, LAND_UNITS, PROPERTY_TYPES, RAPD, REF_PREFIX,
  ROAD_SURFACES, displayRef, isRapd, normalizeRapd, rapdOf, rapdProblem, rapdToSqft, formatPrice, makeRef, nextPropRef, nextPropertyId, refNumber, saveProperty,
  type Listing, type PlanBox, type Prop,
} from "@/app/data/properties";
import { REACTIONS, setReactionCount } from "@/app/data/reviews";
import { gridFromCoords, inNepal, isShortMapLink, placeLabel, resolveMap } from "@/app/data/maps";
import { AMENITIES, AMENITY_GROUPS, amenityIcon } from "@/app/icons/amenities";
import { BORDER_L, FG_LIGHT, GOLD, MAROON, MUTED_L, WHITE, sans, serif } from "@/app/components/ui/brand";
import { DistrictCombobox } from "@/app/components/ui/district-combobox";
import { PhotoManager } from "@/app/components/ui/photo-picker";
import {
  Button, Field, FormSection, Segmented, Select, Stepper, TextArea, TextInput, Toggle,
} from "@/app/components/ui/form-controls";
import { ListingCard } from "@/app/components/ui/property-cards";
import { RefTag } from "@/app/components/ui/property-ref";
import { Chip, Drawer } from "./parts";
import { describeProperty } from "./suggestions";
import { HIGHLIGHT_IDEAS, TAGLINE_IDEAS } from "@/app/data/options";
import { FloorPlanBuilder } from "./FloorPlanBuilder";
import { listingToProp, type ListingSubmission } from "@/app/data/listings";
import { timeAgo } from "@/app/data/messages";

// ─── Draft: the form's working copy of a property ─────────────────────────────
// The form edits friendly pieces (a number and a unit, a road surface and a width);
// toProp() assembles them into the exact strings the site and the API use.

type PriceUnit = "Rupees" | "Lakh" | "Crore";
const PRICE_MULT: Record<PriceUnit, number> = { Rupees: 1, Lakh: 100_000, Crore: 10_000_000 };

type Draft = {
  id: number; propId: string; refNo: string; isNew: boolean;
  title: string; tagline: string; description: string;
  listing: Listing; type: string; badge: string; verified: boolean; featured: boolean;
  district: string; location: string; facing: string; roadSurface: string; roadWidth: number;
  priceAmount: string; priceUnit: PriceUnit;
  builtValue: string; builtUnit: string; landValue: string; landUnit: string;
  beds: number; baths: number; floors: number; buildYear: number;
  photos: string[]; amenities: string[]; highlights: string[]; floorPlan: PlanBox[];
  reactions: number; mapX: number; mapY: number; mapUrl: string;
};

const CANONICAL = new Set(AMENITIES.map(a => a.name));

/** "4,850 sq.ft" → ["4850","sq.ft"]; "—" → ["", fallbackUnit]. */
function splitArea(s: string, fallbackUnit: string): [string, string] {
  const rapd = rapdOf(s);
  if (rapd) return [rapd, RAPD];
  const m = s.match(/^([\d,.]+)\s*(.+)$/);
  return m ? [m[1].replace(/,/g, ""), m[2].trim()] : ["", fallbackUnit];
}
const joinArea = (value: string, unit: string) => {
  if (isRapd(value)) return `${normalizeRapd(value)} ${RAPD}`;
  const n = Number(value);
  return value.trim() && n > 0 ? `${n.toLocaleString("en-US", { maximumFractionDigits: 2 })} ${unit}` : "—";
};

function pickPriceUnit(n: number, listing: Listing): [string, PriceUnit] {
  if (n <= 0) return ["", listing === "For Rent" ? "Rupees" : "Crore"];
  if (n >= 10_000_000) return [String(+(n / 10_000_000).toFixed(4)), "Crore"];
  if (n >= 100_000) return [String(+(n / 100_000).toFixed(4)), "Lakh"];
  return [String(n), "Rupees"];
}

/** The number part of a reference, as the admin types it: "004". */
const refDigits = (propId: string) => String(refNumber(propId)).padStart(3, "0");

function toDraft(p?: Prop): Draft {
  if (!p) {
    const id = nextPropertyId(), propId = nextPropRef();
    return {
      id, propId, refNo: refDigits(propId), isNew: true,
      title: "", tagline: "", description: "",
      listing: "For Sale", type: PROPERTY_TYPES[0], badge: "New", verified: false, featured: false,
      district: "", location: "", facing: "North", roadSurface: ROAD_SURFACES[0], roadWidth: 20,
      priceAmount: "", priceUnit: "Crore",
      builtValue: "", builtUnit: "sq.ft", landValue: "", landUnit: "Ropani",
      beds: 3, baths: 2, floors: 2, buildYear: new Date().getFullYear(),
      photos: [], amenities: [], highlights: [], floorPlan: [],
      // Spread new pins over the Buy / Rent map until a Google Maps link gives the real spot.
      reactions: 0, mapX: 30 + (id * 37) % 40, mapY: 25 + (id * 23) % 45, mapUrl: "",
    };
  }
  const road = p.roadAccess.match(/^(.*?)\s*(\d+)\s*ft$/i);
  const [builtValue, builtUnit] = splitArea(p.builtArea, "sq.ft");
  const [landValue, landUnit] = splitArea(p.landArea, "Ropani");
  const [priceAmount, priceUnit] = pickPriceUnit(p.priceNum, p.listing);
  return {
    id: p.id, propId: p.propId, refNo: refDigits(p.propId), isNew: false,
    title: p.title, tagline: p.tagline, description: p.description,
    listing: p.listing, type: p.type, badge: p.badge, verified: p.verified, featured: p.featured,
    district: p.district, location: p.location, facing: p.facing,
    roadSurface: road ? road[1].trim() : p.roadAccess, roadWidth: road ? Number(road[2]) : 0,
    priceAmount, priceUnit, builtValue, builtUnit, landValue, landUnit,
    beds: p.beds, baths: p.baths, floors: p.floors, buildYear: p.buildYear,
    // The gallery is the photo list; the hero is simply its first photo.
    photos: p.gallery.length ? [...p.gallery] : [p.hero],
    amenities: p.features.filter(f => CANONICAL.has(f)),
    highlights: p.features.filter(f => !CANONICAL.has(f)),
    floorPlan: (p.floorPlan ?? []).map(b => ({ ...b })),
    reactions: REACTIONS[p.id] ?? 0, mapX: p.mapX, mapY: p.mapY, mapUrl: p.mapUrl ?? "",
  };
}

const priceNumOf = (d: Draft) => Math.round((Number(d.priceAmount) || 0) * PRICE_MULT[d.priceUnit]);

function toProp(d: Draft): Prop {
  const priceNum = priceNumOf(d);
  const isLand = d.type === "Land";
  const coords = resolveMap(d.mapUrl, "").coords;
  return {
    // NBS for sale, NBL for rent: the prefix is the listing, the number is the admin's.
    id: d.id, propId: makeRef(d.listing, Number(d.refNo) || 0), badge: d.badge, title: d.title.trim(), tagline: d.tagline.trim(),
    location: d.location.trim() || d.district, district: d.district,
    price: formatPrice(priceNum, d.listing), priceNum, listing: d.listing, type: d.type,
    beds: isLand ? 0 : d.beds, baths: isLand ? 0 : d.baths,
    builtArea: isLand ? "—" : joinArea(d.builtValue, d.builtUnit), landArea: joinArea(d.landValue, d.landUnit),
    roadAccess: d.roadWidth > 0 ? `${d.roadSurface} ${d.roadWidth}ft` : d.roadSurface,
    facing: d.facing, buildYear: isLand ? 0 : d.buildYear, floors: isLand ? 0 : d.floors,
    verified: d.verified, featured: d.featured,
    hero: d.photos[0] ?? "", gallery: [...d.photos], description: d.description.trim(),
    // Highlights first (they are the marketing lines), then the canonical amenities.
    features: [...d.highlights, ...d.amenities],
    ...(coords ? gridFromCoords(coords) : { mapX: d.mapX, mapY: d.mapY }),
    mapUrl: d.mapUrl.trim() || undefined,
    floorPlan: d.floorPlan.length ? d.floorPlan.map(b => ({ ...b, name: b.name.trim() })) : undefined,
  };
}

function problems(d: Draft): string[] {
  const out: string[] = [];
  if (d.title.trim().length < 3) out.push("Give the property a title.");
  const taken = refTakenBy(d);
  if (!(Number(d.refNo) > 0)) out.push("Give the property an ID number.");
  else if (taken) out.push(`ID number ${Number(d.refNo)} is already used by “${taken.title}” (${displayRef(taken.propId)}).`);
  if (!d.district) out.push("Choose the district.");
  if (priceNumOf(d) <= 0) out.push("Enter the price.");
  if (d.photos.length === 0) out.push("Add at least one photo.");
  if (d.description.trim().length < 20) out.push("Write a short description (a sentence or two).");
  if (isRapd(d.landValue)) { const p = rapdProblem(d.landValue); if (p) out.push(`Land area: ${p}`); }
  else if (d.landValue.includes("-")) out.push("Write the land area as Ropani-Aana-Paisa-Dam, e.g. 4-4-0-1.");
  if (d.floorPlan.some(b => !b.name.trim())) out.push("Name every box on the floor plan.");
  if (d.floorPlan.some(b => !(b.area > 0))) out.push("Enter the area of every box on the floor plan.");
  return out;
}

/** The property already using this ID number, if any. Sale and rent share one sequence. */
const refTakenBy = (d: Draft) => {
  const n = Number(d.refNo);
  return n > 0 ? ALL_PROPS.find(p => p.id !== d.id && refNumber(p.propId) === n) ?? null : null;
};

/** A land area was entered: a number, or Ropani-Aana-Paisa-Dam like "4-4-0-1". */
const landFilled = (d: Draft) => (isRapd(d.landValue) ? rapdToSqft(d.landValue) > 0 : Number(d.landValue) > 0);

const YEARS = (() => {
  const now = new Date().getFullYear();
  return [{ value: "0", label: "Not applicable" }, ...Array.from({ length: now + 2 - 1970 + 1 }, (_, i) => String(now + 2 - i))];
})();

// ─── Drafts: autosave so nothing is lost if the tab closes ────────────────────
// A draft is kept in this browser (localStorage) a moment after each change and removed once
// the property is saved or the changes are discarded. Freshly picked photos are temporary
// browser links that do not survive a reload, so they are left out of the draft.

const draftKey = (d: Draft) => `nb-admin-draft:property:${d.isNew ? "new" : d.id}`;
const withoutTempPhotos = (d: Draft): Draft => ({
  ...d,
  photos: d.photos.filter(u => !u.startsWith("blob:")),
});
function readDraft(key: string): Draft | null {
  try { const s = localStorage.getItem(key); return s ? (JSON.parse(s) as Draft) : null; } catch { return null; }
}
function writeDraft(key: string, d: Draft) {
  try { localStorage.setItem(key, JSON.stringify(withoutTempPhotos(d))); } catch { /* storage full or blocked: skip */ }
}
function clearDraft(key: string) {
  try { localStorage.removeItem(key); } catch { /* ignore */ }
}

// ─── Steps: the progress bar and the jump links above the form ────────────────

const STEPS = [
  { id: "basics", label: "Basics" }, { id: "location", label: "Location" }, { id: "price", label: "Price" },
  { id: "size", label: "Size" }, { id: "photos", label: "Photos" }, { id: "amenities", label: "Amenities" },
  { id: "plans", label: "Floor Plans" }, { id: "story", label: "Description" },
] as const;
type StepId = (typeof STEPS)[number]["id"];

function stepDone(d: Draft, id: StepId): boolean {
  switch (id) {
    case "basics": return d.title.trim().length >= 3;
    case "location": return !!d.district;
    case "price": return priceNumOf(d) > 0;
    case "size": return d.type === "Land" ? landFilled(d) : Number(d.builtValue) > 0 || landFilled(d);
    case "photos": return d.photos.length > 0;
    case "amenities": return d.amenities.length + d.highlights.length > 0;
    case "plans": return d.floorPlan.length > 0;
    case "story": return d.description.trim().length >= 20;
  }
}

function Progress({ d }: { d: Draft }) {
  const done = STEPS.filter(s => stepDone(d, s.id)).length;
  const pct = Math.round((done / STEPS.length) * 100);
  const jump = (id: string) => document.getElementById(`pe-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-4">
        <div className="flex-1 h-[3px] rounded-full overflow-hidden" style={{ background: "rgba(26,22,17,0.08)" }}>
          <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: GOLD }} />
        </div>
        <span className="text-[11px] tracking-[0.18em] uppercase tabular-nums shrink-0" style={{ color: FG_LIGHT, ...sans }}>{pct}% ready</span>
      </div>
      <div className="flex gap-1.5 overflow-x-auto pb-0.5" style={{ scrollbarWidth: "none" }}>
        {STEPS.map((s, i) => {
          const ok = stepDone(d, s.id);
          return (
            <button key={s.id} type="button" onClick={() => jump(s.id)}
              className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 border text-[11px] tracking-[0.08em] transition-colors hover:border-[#8a2030]"
              style={{ borderColor: ok ? "rgba(176,136,72,0.55)" : BORDER_L, background: ok ? "rgba(176,136,72,0.08)" : WHITE, color: ok ? FG_LIGHT : MUTED_L, ...sans }}>
              {ok ? <Check size={11} style={{ color: GOLD }} /> : <span className="tabular-nums">{i + 1}</span>}{s.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Live preview ─────────────────────────────────────────────────────────────

function PropertyPreview({ p, amenities, highlights, plans }: { p: Prop; amenities: string[]; highlights: string[]; plans: number }) {
  const [tab, setTab] = useState<"card" | "page">("card");
  const items = [...highlights, ...amenities];
  const inHot = p.featured || p.badge === "Hot";
  const facts = [
    p.beds > 0 && `${p.beds} Beds`, p.baths > 0 && `${p.baths} Baths`,
    p.builtArea !== "—" && p.builtArea, p.landArea !== "—" && p.landArea,
  ].filter(Boolean) as string[];
  return (
    <div className="flex flex-col gap-5">
      <Segmented value={tab} onChange={setTab} options={[{ value: "card", label: "Card" }, { value: "page", label: "Property page" }]} />

      {tab === "card" && <>
        <div className="mx-auto w-full max-w-[340px]"><ListingCard p={p} light showDetails /></div>
        <p className="text-[12px] leading-relaxed text-center" style={{ color: MUTED_L, ...sans }}>
          How visitors see it in New Listings and on the Buy / Rent pages.
        </p>
        <p className="flex items-start gap-2 px-4 py-3 text-[12px] leading-relaxed border" style={{ borderColor: BORDER_L, background: WHITE, color: MUTED_L, ...sans }}>
          <span className="mt-[5px] w-1.5 h-1.5 rounded-full shrink-0" style={{ background: inHot ? GOLD : "rgba(26,22,17,0.2)" }} />
          {inHot ? "Also shown in Hot Properties on the home page." : "Not in Hot Properties. Turn on Featured or choose the Hot badge to add it."}
        </p>
      </>}

      {tab === "page" && (
        <div className="border overflow-hidden" style={{ borderColor: BORDER_L, background: WHITE }}>
          <div className="relative" style={{ aspectRatio: "16/10", background: "#e9e3d8" }}>
            {p.hero
              ? <img src={p.hero} alt="" className="w-full h-full object-cover" />
              : <p className="absolute inset-0 flex items-center justify-center text-[12px]" style={{ color: MUTED_L, ...sans }}>Add a main photo in step 5</p>}
            {p.gallery.length > 1 && (
              <span className="absolute right-3 bottom-3 px-2 py-1 text-[10px] tracking-[0.15em]" style={{ background: "rgba(10,9,8,0.6)", color: WHITE, ...sans }}>{p.gallery.length} photos</span>
            )}
          </div>
          <div className="p-5 flex flex-col gap-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex flex-wrap gap-1.5"><Chip tone="maroon">{p.badge}</Chip><Chip tone="muted">{p.listing}</Chip></div>
              <RefTag propId={p.propId} />
            </div>
            <div>
              <p className="text-[22px] leading-tight" style={{ color: FG_LIGHT, ...serif }}>{p.title || "Property name"}</p>
              {p.tagline && <p className="mt-1 text-[14px] italic" style={{ color: MUTED_L, ...serif }}>{p.tagline}</p>}
              <p className="flex items-center gap-1.5 mt-1.5 text-[13px]" style={{ color: MUTED_L, ...sans }}><MapPin size={12} style={{ color: GOLD }} />{p.location || "Location"}</p>
              <p className="mt-2 text-[18px] font-medium" style={{ color: MAROON, ...sans }}>{p.price}</p>
            </div>
            {facts.length > 0 && (
              <p className="flex flex-wrap gap-x-4 gap-y-1 py-3 border-y text-[12px]" style={{ borderColor: BORDER_L, color: MUTED_L, ...sans }}>
                {facts.map(f => <span key={f}>{f}</span>)}
              </p>
            )}
            {p.description && (
              <p className="text-[13px] leading-[1.75] line-clamp-4" style={{ color: MUTED_L, ...sans }}>{p.description}</p>
            )}
            <div>
              <p className="text-[10px] tracking-[0.28em] uppercase mb-2" style={{ color: GOLD, ...sans }}>Features & Amenities</p>
              {items.length === 0 ? (
                <p className="text-[12px]" style={{ color: MUTED_L, ...sans }}>Pick amenities in step 6 and they appear here with their icons.</p>
              ) : (
                <div className="grid grid-cols-2 gap-x-4">
                  {items.slice(0, 8).map(f => {
                    const Icon = amenityIcon(f);
                    return (
                      <div key={f} className="flex items-center gap-2.5 py-2 border-b" style={{ borderColor: BORDER_L }}>
                        <span className="w-4 flex justify-center shrink-0" style={{ color: GOLD }}>{Icon ? <Icon size={16} /> : <span className="w-1.5 h-1.5 rounded-full" style={{ background: GOLD }} />}</span>
                        <span className="text-[12px] truncate" style={{ color: MUTED_L, ...sans }}>{f}</span>
                      </div>
                    );
                  })}
                </div>
              )}
              {items.length > 8 && <p className="mt-2 text-[12px]" style={{ color: MUTED_L, ...sans }}>and {items.length - 8} more on the page</p>}
            </div>
            {plans > 0 && <p className="text-[12px]" style={{ color: MUTED_L, ...sans }}>Floor plan: {plans} box{plans === 1 ? "" : "es"}, shown on the property page.</p>}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Property ID: NBS (for sale) or NBL (letting), then a number, with the result shown as it
 * will appear on the site. Choosing the prefix also sets the listing, so the two never disagree.
 */
function PropertyIdField({ listing, refNo, taken, onListing, onRefNo, className = "" }: {
  listing: Listing; refNo: string; taken: Prop | null;
  onListing: (v: Listing) => void; onRefNo: (v: string) => void; className?: string;
}) {
  const n = Number(refNo);
  const nextFree = () => onRefNo(String(refNumber(nextPropRef())).padStart(3, "0"));
  return (
    <Field label="Property ID" className={className}
      hint={taken
        ? <span style={{ color: MAROON }}>Number {n} is already used by “{taken.title}”. <button type="button" onClick={nextFree} className="underline underline-offset-4">Use the next free number</button></span>
        : "NBS = for sale, NBL = letting (rent). Sale and rent share one number sequence."}>
      <div className="grid grid-cols-1 sm:grid-cols-[13rem_1fr_11rem] gap-3">
        <Select value={listing} onChange={v => onListing(v as Listing)}
          options={[{ value: "For Sale", label: `${REF_PREFIX["For Sale"]} · For Sale` }, { value: "For Rent", label: `${REF_PREFIX["For Rent"]} · Letting (Rent)` }]} />
        <TextInput value={refNo} onChange={v => onRefNo(v.replace(/\D/g, "").slice(0, 6))} placeholder="e.g. 345" />
        <div className="h-[50px] flex items-center justify-center gap-0.5 border text-[17px] font-medium tracking-[0.12em] tabular-nums"
          aria-live="polite" title="As shown on the site"
          style={{ borderColor: taken ? "rgba(138,32,48,0.45)" : "rgba(176,136,72,0.45)", background: taken ? "rgba(138,32,48,0.05)" : "rgba(176,136,72,0.07)", color: FG_LIGHT, ...sans }}>
          <span style={{ color: GOLD }}>#</span>{n > 0 ? makeRef(listing, n) : `${REF_PREFIX[listing]}···`}
        </div>
      </div>
    </Field>
  );
}

/**
 * A pasted Google Maps link and, right under it, the map the property page will show.
 * With no link the map shows the area by name, so every property still gets a map.
 */
function MapLinkField({ url, area, onChange, className = "" }: {
  url: string; area: string; onChange: (v: string) => void; className?: string;
}) {
  const map = resolveMap(url, area || "Kathmandu");
  const trimmed = url.trim();
  const note =
    !trimmed ? (area ? `No link yet, so the map shows “${area}” by name.` : "Choose the district, or paste a link, to see the map.")
    : map.source === "pin" || map.source === "embed" ? (map.coords && !inNepal(map.coords) ? "This pin is outside Nepal. Check the link." : "Exact pin found. This is the map visitors will see.")
    : isShortMapLink(trimmed) ? "Short share links can’t be read in the browser, so the map shows the area by name. For the exact pin, open the link and copy the long address from the browser bar."
    : map.source === "place" ? "Place found by name. For an exact pin, copy the link after dropping a pin in Google Maps."
    : "No location found in this link. Paste a Google Maps link or coordinates like 27.6710, 85.3150.";
  const warn = !!trimmed && (map.source === "area" || (map.coords !== null && !inNepal(map.coords)));
  return (
    <Field label="Google Maps Link" className={className} hint="In Google Maps: Share → Copy link. The property page shows this as a map with an “Open in Google Maps” button.">
      <TextInput value={url} onChange={onChange} placeholder="https://maps.app.goo.gl/…  or  https://www.google.com/maps/place/…" />
      <div className="relative mt-1 border overflow-hidden" style={{ borderColor: BORDER_L, background: "#e9e3d8", aspectRatio: "16/7" }}>
        {(trimmed || area) && <iframe key={map.src} src={map.src} title="Map preview" loading="lazy" referrerPolicy="no-referrer-when-downgrade" className="absolute inset-0 w-full h-full border-0" />}
      </div>
      <p className="flex items-start gap-2 text-[12px] leading-relaxed" style={{ color: warn ? MAROON : MUTED_L, ...sans }}>
        <MapPin size={13} className="mt-0.5 shrink-0" style={{ color: warn ? MAROON : GOLD }} />{note}
      </p>
    </Field>
  );
}

/** A row of one-tap suggestion chips. */
function IdeaChips({ label, ideas, onPick }: { label: string; ideas: string[]; onPick: (idea: string) => void }) {
  if (!ideas.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-2 mt-1">
      <span className="flex items-center gap-1.5 text-[11px] tracking-[0.12em] uppercase mr-1" style={{ color: GOLD, ...sans }}><Lightbulb size={13} />{label}</span>
      {ideas.map(i => (
        <button key={i} type="button" onClick={() => onPick(i)}
          className="px-3 py-1.5 border text-[12px] transition-colors hover:border-[#8a2030] hover:text-[#8a2030]"
          style={{ borderColor: BORDER_L, background: WHITE, color: FG_LIGHT, ...sans }}>{i}</button>
      ))}
    </div>
  );
}

// ─── The editor ───────────────────────────────────────────────────────────────

/**
 * Add, edit or duplicate a property. `template` starts a new listing as a copy of an
 * existing one (new reference, reactions reset), for quickly adding similar units.
 */
export function PropertyEditor({ property, template = null, source = null, open, onClose, onSaved, onViewOnSite }: {
  property: Prop | null; template?: Prop | null; open: boolean; onClose: () => void;
  onSaved: (message: string) => void; onViewOnSite: (id: number) => void;
  /** A seller's free listing being turned into a property (Admin → Free Listings). */
  source?: { submission: ListingSubmission; onSaveForLater: (p: Prop) => void; onPublished: (p: Prop) => void; onReject: () => void } | null;
}) {
  const start = (): Draft => source
    ? { ...toDraft(listingToProp(source.submission)), isNew: true }
    : template
    ? (() => { const propId = nextPropRef(template.listing); return { ...toDraft(template), id: nextPropertyId(), propId, refNo: refDigits(propId), isNew: true, title: `${template.title} (copy)`, reactions: 0 }; })()
    : toDraft(property ?? undefined);
  // Each free listing gets its own autosave slot, so two reviews never overwrite each other.
  const keyFor = (x: Draft) => (source ? `nb-admin-draft:listing:${source.submission.id}` : draftKey(x));

  const [d, setD] = useState<Draft>(start);
  const [base, setBase] = useState(() => JSON.stringify(d));
  const [tried, setTried] = useState(false);
  const [styleNo, setStyleNo] = useState(0);
  const [restore, setRestore] = useState<Draft | null>(null);

  // A fresh draft each time the drawer opens, for whatever it opened on.
  useEffect(() => {
    if (!open) return;
    const s = start();
    setD(s); setBase(JSON.stringify(s)); setTried(false); setStyleNo(0);
    const saved = readDraft(keyFor(s));
    setRestore(saved && JSON.stringify({ ...saved, id: s.id, propId: s.propId }) !== JSON.stringify(withoutTempPhotos(s)) ? saved : null);
  }, [open, property, template, source]);

  const dirty = JSON.stringify(d) !== base;
  // Autosave a moment after typing stops.
  useEffect(() => {
    if (!open || !dirty) return;
    const t = window.setTimeout(() => writeDraft(keyFor(d), d), 700);
    return () => window.clearTimeout(t);
  }, [d, open, dirty]);

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD(o => ({ ...o, [k]: v }));
  const issues = problems(d);
  const isLand = d.type === "Land";
  const priceNum = priceNumOf(d);
  const pricePreview = priceNum > 0 ? formatPrice(priceNum, d.listing) : "—";

  // What the site would show if saved now, with friendly stand-ins for empty fields.
  const assembled = toProp(d);
  const previewProp: Prop = {
    ...assembled,
    title: assembled.title || "Your property title",
    location: d.location.trim() || d.district || "Location",
    price: priceNum > 0 ? assembled.price : "Price not set",
  };
  const facts = {
    title: d.title.trim(), type: d.type, listing: d.listing, location: placeLabel(d.location, d.district), district: d.district,
    facing: d.facing, roadAccess: assembled.roadAccess, beds: d.beds, baths: d.baths, floors: d.floors,
    builtArea: assembled.builtArea, landArea: assembled.landArea, amenities: d.amenities, highlights: d.highlights,
    buildYear: d.buildYear, price: priceNum > 0 ? assembled.price : "", verified: d.verified,
  };

  const close = () => { clearDraft(keyFor(d)); onClose(); };
  const save = () => {
    setTried(true);
    if (issues.length) return;
    const p = toProp(d);
    saveProperty(p);
    setReactionCount(d.id, d.reactions);
    clearDraft(keyFor(d));
    source?.onPublished(p);
    onSaved(source ? `“${d.title.trim()}” is now live on the website` : d.isNew ? `“${d.title.trim()}” added to the site` : `“${d.title.trim()}” updated`);
    onClose();
  };
  /** Free listings only: keep the edits without publishing. Gaps are allowed. */
  const saveForLater = () => {
    if (!source) return;
    source.onSaveForLater(toProp(d));
    clearDraft(keyFor(d));
    onSaved(`“${d.title.trim() || "Listing"}” saved. Publish it whenever it is ready.`);
    onClose();
  };

  const footer = (
    <>
      {tried && issues.length > 0 && (
        <p className="sm:mr-auto text-[13px]" style={{ color: MAROON, ...sans }}>{issues[0]}{issues.length > 1 ? ` (+${issues.length - 1} more)` : ""}</p>
      )}
      {!d.isNew && <Button variant="quiet" onClick={() => onViewOnSite(d.id)}><Eye size={14} />View on Site</Button>}
      {source && <Button variant="quiet" onClick={() => { clearDraft(keyFor(d)); source.onReject(); }}><X size={14} />Reject</Button>}
      {source && <Button variant="quiet" onClick={saveForLater}><Clock size={14} />Save for Later</Button>}
      <Button onClick={save} title="Ctrl + S"><Check size={14} />{source ? "Publish Now" : d.isNew ? "Publish Property" : "Save Changes"}</Button>
    </>
  );

  return (
    <Drawer open={open} onClose={close} backLabel={source ? "Back to Free Listings" : "Back to Properties"} dirty={dirty} onSave={save}
      title={source ? "Review Free Listing" : template ? `Copy of ${template.title}` : d.isNew ? "Add a Property" : `Edit ${property?.title ?? "Property"}`}
      subtitle={source
        ? `From ${source.submission.seller.name}, ${timeAgo(source.submission.receivedAt)} · Will publish as ${displayRef(assembled.propId)} · Fill the gaps, then publish now or later`
        : `Property ID ${displayRef(assembled.propId)} · Saved as a draft while you work · Ctrl + S to save`}
      headerExtra={<Progress d={d} />}
      preview={<PropertyPreview p={previewProp} amenities={d.amenities} highlights={d.highlights} plans={d.floorPlan.length} />}
      previewTitle="Live preview" footer={footer}>
      <div className="flex flex-col gap-6">
        {source && <SellerPanel s={source.submission} />}
        {restore && (
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 border px-5 py-4" style={{ borderColor: "rgba(176,136,72,0.45)", background: "rgba(176,136,72,0.08)" }}>
            <History size={18} className="shrink-0" style={{ color: GOLD }} />
            <p className="flex-1 text-[14px] leading-relaxed" style={{ color: FG_LIGHT, ...sans }}>
              You have unsaved changes from earlier. Restore them? <span style={{ color: MUTED_L }}>(Photos picked before then need adding again.)</span>
            </p>
            <div className="flex gap-2 shrink-0">
              <Button variant="quiet" onClick={() => { clearDraft(draftKey(d)); setRestore(null); }}>Discard</Button>
              <Button onClick={() => { setD(o => ({ ...restore, id: o.id, propId: o.propId, isNew: o.isNew, refNo: restore.refNo ?? o.refNo, mapUrl: restore.mapUrl ?? o.mapUrl })); setRestore(null); }}>Restore</Button>
            </div>
          </div>
        )}

        {tried && issues.length > 0 && (
          <div className="border px-5 py-4" style={{ borderColor: "rgba(138,32,48,0.35)", background: "rgba(138,32,48,0.05)" }}>
            <p className="text-[12px] tracking-[0.2em] uppercase mb-2" style={{ color: MAROON, ...sans }}>Almost there</p>
            <ul className="list-disc pl-5 text-[14px] leading-relaxed" style={{ color: FG_LIGHT, ...sans }}>{issues.map(i => <li key={i}>{i}</li>)}</ul>
          </div>
        )}

        <FormSection id="pe-basics" n={1} title="The Basics" subtitle="What it is and how it is marked on the site.">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <Field label="Property Title" className="md:col-span-2"><TextInput value={d.title} onChange={v => set("title", v)} placeholder="e.g. The Patan Residence" maxLength={90} /></Field>
            <PropertyIdField className="md:col-span-2" listing={d.listing} refNo={d.refNo} taken={refTakenBy(d)}
              onListing={v => set("listing", v)} onRefNo={v => set("refNo", v)} />
            <Field label="Property Type"><Select value={d.type} onChange={v => set("type", v)} options={PROPERTY_TYPES} /></Field>
            <Field label="Badge" hint="The coloured label on the photo."><Select value={d.badge} onChange={v => set("badge", v)} options={BADGES.includes(d.badge) ? BADGES : [d.badge, ...BADGES]} /></Field>
            <Field label="Short Tagline" hint="Optional. Shown in italics under the property name: on the property page and, for Featured properties, in the home page slideshow.">
              <TextInput value={d.tagline} onChange={v => set("tagline", v)} maxLength={60} placeholder="e.g. Heritage Reimagined" />
              {!d.tagline && <IdeaChips label="Ideas" ideas={TAGLINE_IDEAS.slice(0, 4)} onPick={v => set("tagline", v)} />}
            </Field>
            <Toggle checked={d.featured} onChange={v => set("featured", v)} label="Featured" description="Shown in the home page hero and Hot Properties." />
            <Toggle checked={d.verified} onChange={v => set("verified", v)} label="Verified" description="Our team has checked the documents." />
          </div>
        </FormSection>

        <FormSection id="pe-location" n={2} title="Location" subtitle="Where it is and how you reach it.">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <Field label="District" hint="Type to search all 77 districts.">
              <DistrictCombobox value={d.district} onChange={v => setD(o => ({ ...o, district: v, location: o.location || v }))} placeholder="e.g. Lalitpur" />
            </Field>
            <Field label="Area Shown on the Listing" hint="Neighbourhood and city, e.g. “Jawlakhel, Lalitpur”."><TextInput value={d.location} onChange={v => set("location", v)} placeholder="Jawlakhel, Lalitpur" /></Field>
            <Field label="Facing"><Select value={d.facing} onChange={v => set("facing", v)} options={FACINGS.includes(d.facing) ? FACINGS : [d.facing, ...FACINGS]} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Road Surface"><Select value={d.roadSurface} onChange={v => set("roadSurface", v)} options={ROAD_SURFACES.includes(d.roadSurface) ? ROAD_SURFACES : [d.roadSurface, ...ROAD_SURFACES]} /></Field>
              <Field label="Road Width"><Stepper value={d.roadWidth} onChange={v => set("roadWidth", v)} max={200} suffix="ft" /></Field>
            </div>
            <MapLinkField className="md:col-span-2" url={d.mapUrl} onChange={v => set("mapUrl", v)}
              area={placeLabel(d.location, d.district)} />
          </div>
        </FormSection>

        <FormSection id="pe-price" n={3} title="Price" subtitle={d.listing === "For Rent" ? "Monthly rent." : "Asking price."}>
          <div className="grid grid-cols-1 md:grid-cols-[1fr_12rem_1fr] gap-5 items-start">
            <Field label="Amount"><TextInput value={d.priceAmount} onChange={v => set("priceAmount", v.replace(/[^\d.]/g, ""))} placeholder={d.priceUnit === "Crore" ? "e.g. 8.5" : "e.g. 85000"} /></Field>
            <Field label="In"><Select value={d.priceUnit} onChange={v => set("priceUnit", v as PriceUnit)} options={["Crore", "Lakh", "Rupees"]} /></Field>
            <Field label="Shown on the site as">
              <div className="h-[50px] flex items-center px-4 border text-[17px] font-medium" style={{ borderColor: "rgba(176,136,72,0.45)", background: "rgba(176,136,72,0.07)", color: MAROON, ...sans }}>{pricePreview}</div>
            </Field>
          </div>
        </FormSection>

        <FormSection id="pe-size" n={4} title="Size & Rooms" subtitle={isLand ? "Land only needs its area. Rooms are hidden for land." : "Zero hides a figure on the site."}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {!isLand && (
              <div className="grid grid-cols-[1fr_7rem] gap-3">
                <Field label="Built Area"><TextInput value={d.builtValue} onChange={v => set("builtValue", v.replace(/[^\d.]/g, ""))} placeholder="e.g. 4850" /></Field>
                <Field label="Unit"><Select value={d.builtUnit} onChange={v => set("builtUnit", v)} options={BUILT_UNITS.includes(d.builtUnit) ? BUILT_UNITS : [d.builtUnit, ...BUILT_UNITS]} /></Field>
              </div>
            )}
            <LandAreaField value={d.landValue} unit={d.landUnit} onValue={v => set("landValue", v)} onUnit={v => set("landUnit", v)} />
            {!isLand && <>
              <Field label="Bedrooms"><Stepper value={d.beds} onChange={v => set("beds", v)} max={50} /></Field>
              <Field label="Bathrooms"><Stepper value={d.baths} onChange={v => set("baths", v)} max={50} /></Field>
              <Field label="Floors"><Stepper value={d.floors} onChange={v => set("floors", v)} max={60} /></Field>
              <Field label="Build Year"><Select value={String(d.buildYear)} onChange={v => set("buildYear", Number(v))} options={YEARS} /></Field>
            </>}
          </div>
        </FormSection>

        <FormSection id="pe-photos" n={5} title="Photos" subtitle="The first photo is the cover shown on cards and at the top of the page.">
          <PhotoManager photos={d.photos} onChange={v => set("photos", v)} />
        </FormSection>

        <FormSection id="pe-amenities" n={6} title="Amenities" subtitle="Tap every amenity the property has. Icons appear on the property page.">
          <AmenityPicker selected={d.amenities} onChange={v => set("amenities", v)} />
          <div className="mt-8 pt-7 border-t" style={{ borderColor: BORDER_L }}>
            <HighlightsInput values={d.highlights} onChange={v => set("highlights", v)} />
            <IdeaChips label="Ideas" ideas={HIGHLIGHT_IDEAS.filter(i => !d.highlights.includes(i) && !CANONICAL.has(i)).slice(0, 6)} onPick={v => set("highlights", [...d.highlights, v])} />
          </div>
        </FormSection>

        <FormSection id="pe-plans" n={7} title="Floor Plans" subtitle="Optional. Drag boxes onto the plan and give each a floor name and area. Visitors see them when they hover.">
          <FloorPlanBuilder boxes={d.floorPlan} onChange={v => set("floorPlan", v)} />
        </FormSection>

        <FormSection id="pe-story" n={8} title="Description & Engagement">
          <div className="flex flex-col gap-6">
            <Field label="Description" hint="Two or three sentences work best. Use “Write it for me” for a first draft, then adjust.">
              <TextArea rows={5} value={d.description} onChange={v => set("description", v)} placeholder="What makes this property special?" />
              <div className="flex flex-wrap gap-2 mt-1">
                <button type="button" onClick={() => { set("description", describeProperty(facts, styleNo)); setStyleNo(n => n + 1); }}
                  className="inline-flex items-center gap-2 px-4 py-2.5 border text-[11px] tracking-[0.2em] uppercase transition-colors hover:border-[#8a2030]"
                  style={{ borderColor: "rgba(176,136,72,0.55)", background: "rgba(176,136,72,0.08)", color: FG_LIGHT, ...sans }}>
                  <Sparkles size={14} style={{ color: GOLD }} />{styleNo === 0 ? "Write it for me" : "Try another style"}
                </button>
              </div>
            </Field>
            <ReactionControl value={d.reactions} onChange={v => set("reactions", v)} />
          </div>
        </FormSection>
      </div>
    </Drawer>
  );
}

// ─── Free listing: the seller's private details ──────────────────────────────

/** What the seller sent, for reference while editing. None of it is published as is. */
function SellerPanel({ s }: { s: ListingSubmission }) {
  const row = (label: string, value: string) => value.trim() ? (
    <div className="flex gap-3 text-[13px]"><span className="w-28 shrink-0" style={{ color: MUTED_L, ...sans }}>{label}</span><span style={{ color: FG_LIGHT, ...sans }}>{value}</span></div>
  ) : null;
  return (
    <div className="border p-5 md:p-6 flex flex-col gap-4" style={{ borderColor: "rgba(176,136,72,0.45)", background: "rgba(176,136,72,0.06)" }}>
      <div className="flex flex-wrap items-center gap-3">
        <span className="inline-flex items-center gap-2 text-[10px] tracking-[0.26em] uppercase" style={{ color: GOLD, ...sans }}><Lock size={13} />Seller details · private</span>
        <span className="text-[12px]" style={{ color: MUTED_L, ...sans }}>Never shown on the website. Visitors contact Nepal Bhoomi instead.</span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2">
        {row("Name", s.seller.name)}
        {row("Phone", s.seller.phone)}
        {row("Email", s.seller.email ?? "")}
        {row("Price asked", s.price)}
        {row("Built area", s.builtArea)}
        {row("Land area", s.landArea)}
        {row("Build year", s.buildYear)}
        {row("Photos sent", String(s.photos.length))}
      </div>
      {s.description.trim() && <p className="text-[13px] leading-relaxed border-t pt-3" style={{ borderColor: "rgba(176,136,72,0.3)", color: FG_LIGHT, ...sans }}>“{s.description}”</p>}
      <p className="text-[12px]" style={{ color: MUTED_L, ...sans }}>
        The form below starts from what the seller sent. Change or remove anything you don’t want published; the red list at the bottom shows what is still missing.
      </p>
    </div>
  );
}

// ─── Land area ───────────────────────────────────────────────────────────────

/**
 * Land area: a number with a unit ("12" Ropani), or Nepali Ropani-Aana-Paisa-Dam typed with
 * dashes ("4-4-0-1"). As soon as a dash is typed the unit is fixed to R-A-P-D.
 */
function LandAreaField({ value, unit, onValue, onUnit }: { value: string; unit: string; onValue: (v: string) => void; onUnit: (v: string) => void }) {
  const dashed = value.includes("-");
  const rapd = isRapd(value);
  // Still typing "4-4-" is fine; a finished value that isn't R-A-P-D gets a hint.
  const problem = rapd ? rapdProblem(value) : dashed && !value.endsWith("-") ? "Write it as Ropani-Aana-Paisa-Dam, at most four parts, e.g. 4-4-0-1." : null;
  const hint = problem
    ? <span style={{ color: MAROON }}>{problem}</span>
    : rapd ? <>Ropani-Aana-Paisa-Dam · shown as “{normalizeRapd(value)} {RAPD}” · about {rapdToSqft(value).toLocaleString("en-US")} sq.ft</>
    : "A number, or Ropani-Aana-Paisa-Dam with dashes, e.g. 4-4-0-1.";
  return (
    <Field label="Land Area" hint={hint}>
      <div className="grid grid-cols-[1fr_7rem] gap-3">
        <TextInput value={value} onChange={v => onValue(v.replace(/[^\d.-]/g, "").replace(/-{2,}/g, "-").replace(/^-/, ""))} placeholder="e.g. 12 or 4-4-0-1" />
        {dashed ? (
          <div className="h-[50px] flex items-center justify-center border text-[13px] tracking-[0.08em] cursor-not-allowed" title="Fixed while the area is written with dashes"
            aria-disabled="true" style={{ borderColor: BORDER_L, background: "rgba(26,22,17,0.04)", color: MUTED_L, ...sans }}>{RAPD}</div>
        ) : (
          <Select value={unit === RAPD ? "Ropani" : unit} onChange={onUnit} options={LAND_UNITS.includes(unit) || unit === RAPD ? LAND_UNITS : [unit, ...LAND_UNITS]} />
        )}
      </div>
    </Field>
  );
}

// ─── Amenity tiles ────────────────────────────────────────────────────────────

function AmenityPicker({ selected, onChange }: { selected: string[]; onChange: (v: string[]) => void }) {
  const [q, setQ] = useState("");
  const query = q.trim().toLowerCase();
  const toggle = (name: string) => onChange(selected.includes(name) ? selected.filter(x => x !== name) : [...selected, name]);
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex-1"><TextInput value={q} onChange={setQ} placeholder="Find an amenity, e.g. parking" /></div>
        <p className="text-[12px] tracking-[0.14em] uppercase shrink-0" style={{ color: MUTED_L, ...sans }}>
          <span style={{ color: FG_LIGHT }}>{selected.length}</span> selected
          {selected.length > 0 && <button type="button" onClick={() => onChange([])} className="ml-3 underline underline-offset-4 transition-colors hover:text-[#8a2030]">Clear</button>}
        </p>
      </div>
      {AMENITY_GROUPS.map(group => {
        const items = AMENITIES.filter(a => a.group === group && (!query || a.name.toLowerCase().includes(query)));
        if (!items.length) return null;
        return (
          <div key={group}>
            <p className="text-[10px] tracking-[0.28em] uppercase mb-3" style={{ color: GOLD, ...sans }}>{group}</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
              {items.map(({ name, Icon }) => {
                const on = selected.includes(name);
                return (
                  <button key={name} type="button" onClick={() => toggle(name)} aria-pressed={on}
                    className="relative flex flex-col items-center justify-center gap-2.5 px-3 py-5 border text-center transition-all hover:-translate-y-px"
                    style={{ borderColor: on ? GOLD : BORDER_L, background: on ? "rgba(176,136,72,0.08)" : WHITE, boxShadow: on ? "0 6px 18px rgba(176,136,72,0.14)" : "none" }}>
                    {on && <span className="absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center" style={{ background: GOLD, color: WHITE }}><Check size={12} /></span>}
                    <span style={{ color: on ? MAROON : GOLD }}><Icon size={26} /></span>
                    <span className="text-[13px] leading-tight" style={{ color: on ? FG_LIGHT : MUTED_L, ...sans }}>{name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Free-text marketing lines ("Infinity Pool") that sit alongside the amenities. */
function HighlightsInput({ values, onChange }: { values: string[]; onChange: (v: string[]) => void }) {
  const [text, setText] = useState("");
  const add = () => {
    const t = text.trim();
    if (!t || values.some(v => v.toLowerCase() === t.toLowerCase())) { setText(""); return; }
    onChange([...values, t]); setText("");
  };
  return (
    <Field label="Highlights" hint="Your own selling points, e.g. “Infinity Pool” or “3-Car Garage”. Press Enter to add each one.">
      <div className="flex gap-3">
        <div className="flex-1" onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); add(); } }}>
          <TextInput value={text} onChange={setText} placeholder="Type a highlight" maxLength={40} />
        </div>
        <Button variant="quiet" onClick={add}><Plus size={14} />Add</Button>
      </div>
      {values.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-2">
          {values.map(v => {
            const Icon = amenityIcon(v);
            return (
              <span key={v} className="inline-flex items-center gap-2 pl-3 pr-1.5 py-1.5 border text-[13px]" style={{ borderColor: BORDER_L, background: WHITE, color: FG_LIGHT, ...sans }}>
                {Icon && <span style={{ color: GOLD }}><Icon size={15} /></span>}{v}
                <button type="button" aria-label={`Remove ${v}`} onClick={() => onChange(values.filter(x => x !== v))} className="p-1 transition-colors hover:text-[#8a2030]" style={{ color: MUTED_L }}><X size={13} /></button>
              </span>
            );
          })}
        </div>
      )}
    </Field>
  );
}

// ─── Reactions ────────────────────────────────────────────────────────────────

/** The heart count visitors see. The admin can set it or nudge it up. */
export function ReactionControl({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <Field label="Reactions" hint="The number next to the heart on the listing. Visitors’ own reactions add to it.">
      <div className="flex flex-col md:flex-row md:items-center gap-4 border p-5" style={{ borderColor: BORDER_L, background: "#fbf9f5" }}>
        <div className="flex items-center gap-3 shrink-0">
          <span className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: "rgba(138,32,48,0.08)", color: MAROON }}><Heart size={20} fill={MAROON} /></span>
          <span className="text-[2rem] leading-none tabular-nums" style={{ color: FG_LIGHT, ...serif }}>{value.toLocaleString("en-US")}</span>
        </div>
        <div className="flex-1 max-w-xs"><Stepper value={value} onChange={onChange} max={1_000_000} /></div>
        <div className="flex gap-2">
          {[10, 50, 100].map(n => (
            <button key={n} type="button" onClick={() => onChange(Math.min(1_000_000, value + n))}
              className="px-3.5 py-2.5 border text-[12px] tabular-nums transition-colors hover:border-[#8a2030]"
              style={{ borderColor: BORDER_L, background: WHITE, color: FG_LIGHT, ...sans }}>+{n}</button>
          ))}
        </div>
      </div>
    </Field>
  );
}
