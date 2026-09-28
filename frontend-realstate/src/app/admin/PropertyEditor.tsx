import { useEffect, useState } from "react";
import { Check, Eye, Heart, History, Lightbulb, MapPin, Plus, Sparkles, Trash2, X } from "lucide-react";
import {
  BADGES, BUILT_UNITS, FACINGS, FLOOR_LABELS, LAND_UNITS, LISTINGS, PROPERTY_TYPES,
  ROAD_SURFACES, ROOM_NAMES, formatPrice, nextPropRef, nextPropertyId, saveProperty,
  type FloorPlan, type Listing, type Prop,
} from "@/app/data/properties";
import { REACTIONS, setReactionCount } from "@/app/data/reviews";
import { AMENITIES, AMENITY_GROUPS, amenityIcon } from "@/app/icons/amenities";
import { BORDER_L, FG_LIGHT, GOLD, MAROON, MUTED_L, WHITE, sans, serif } from "@/app/components/ui/brand";
import { DistrictCombobox } from "@/app/components/ui/district-combobox";
import { ImageField, PhotoManager } from "@/app/components/ui/photo-picker";
import {
  Button, Field, FormSection, Segmented, Select, Stepper, TextArea, TextInput, Toggle,
} from "@/app/components/ui/form-controls";
import { HotCard, ListingCard } from "@/app/components/ui/property-cards";
import { Chip, Drawer } from "./parts";
import { HIGHLIGHT_IDEAS, describeProperty, taglineIdeas } from "./suggestions";

// ─── Draft: the form's working copy of a property ─────────────────────────────
// The form edits friendly pieces (a number and a unit, a road surface and a width);
// toProp() assembles them into the exact strings the site and the API use.

type PriceUnit = "Rupees" | "Lakh" | "Crore";
const PRICE_MULT: Record<PriceUnit, number> = { Rupees: 1, Lakh: 100_000, Crore: 10_000_000 };

type Draft = {
  id: number; propId: string; isNew: boolean;
  title: string; tagline: string; description: string;
  listing: Listing; type: string; badge: string; verified: boolean; featured: boolean;
  district: string; location: string; facing: string; roadSurface: string; roadWidth: number;
  priceAmount: string; priceUnit: PriceUnit;
  builtValue: string; builtUnit: string; landValue: string; landUnit: string;
  beds: number; baths: number; floors: number; buildYear: number;
  photos: string[]; amenities: string[]; highlights: string[]; floorPlans: FloorPlan[];
  reactions: number; mapX: number; mapY: number;
};

const CANONICAL = new Set(AMENITIES.map(a => a.name));

/** "4,850 sq.ft" → ["4850","sq.ft"]; "—" → ["", fallbackUnit]. */
function splitArea(s: string, fallbackUnit: string): [string, string] {
  const m = s.match(/^([\d,.]+)\s*(.+)$/);
  return m ? [m[1].replace(/,/g, ""), m[2].trim()] : ["", fallbackUnit];
}
const joinArea = (value: string, unit: string) => {
  const n = Number(value);
  return value.trim() && n > 0 ? `${n.toLocaleString("en-US", { maximumFractionDigits: 2 })} ${unit}` : "—";
};

function pickPriceUnit(n: number, listing: Listing): [string, PriceUnit] {
  if (n <= 0) return ["", listing === "For Rent" ? "Rupees" : "Crore"];
  if (n >= 10_000_000) return [String(+(n / 10_000_000).toFixed(4)), "Crore"];
  if (n >= 100_000) return [String(+(n / 100_000).toFixed(4)), "Lakh"];
  return [String(n), "Rupees"];
}

function toDraft(p?: Prop): Draft {
  if (!p) {
    return {
      id: nextPropertyId(), propId: nextPropRef(), isNew: true,
      title: "", tagline: "", description: "",
      listing: "For Sale", type: PROPERTY_TYPES[0], badge: "New", verified: false, featured: false,
      district: "", location: "", facing: "North", roadSurface: ROAD_SURFACES[0], roadWidth: 20,
      priceAmount: "", priceUnit: "Crore",
      builtValue: "", builtUnit: "sq.ft", landValue: "", landUnit: "Ropani",
      beds: 3, baths: 2, floors: 2, buildYear: new Date().getFullYear(),
      photos: [], amenities: [], highlights: [], floorPlans: [],
      reactions: 0, mapX: 50, mapY: 50,
    };
  }
  const road = p.roadAccess.match(/^(.*?)\s*(\d+)\s*ft$/i);
  const [builtValue, builtUnit] = splitArea(p.builtArea, "sq.ft");
  const [landValue, landUnit] = splitArea(p.landArea, "Ropani");
  const [priceAmount, priceUnit] = pickPriceUnit(p.priceNum, p.listing);
  return {
    id: p.id, propId: p.propId, isNew: false,
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
    floorPlans: (p.floorPlans ?? []).map(f => ({ ...f, rooms: f.rooms.map(r => ({ ...r })) })),
    reactions: REACTIONS[p.id] ?? 0, mapX: p.mapX, mapY: p.mapY,
  };
}

const priceNumOf = (d: Draft) => Math.round((Number(d.priceAmount) || 0) * PRICE_MULT[d.priceUnit]);

function toProp(d: Draft): Prop {
  const priceNum = priceNumOf(d);
  const isLand = d.type === "Land";
  return {
    id: d.id, propId: d.propId, badge: d.badge, title: d.title.trim(), tagline: d.tagline.trim(),
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
    mapX: d.mapX, mapY: d.mapY,
    // Drop half-typed room sizes, and floors with neither a drawing nor a room.
    floorPlans: (() => {
      const plans = d.floorPlans
        .map(f => ({ ...f, rooms: f.rooms.map(r => ({ name: r.name, dims: completeDims(r.dims) })) }))
        .filter(f => f.image || f.rooms.length > 0);
      return plans.length ? plans : undefined;
    })(),
  };
}

function problems(d: Draft): string[] {
  const out: string[] = [];
  if (d.title.trim().length < 3) out.push("Give the property a title.");
  if (!d.district) out.push("Choose the district.");
  if (priceNumOf(d) <= 0) out.push("Enter the price.");
  if (d.photos.length === 0) out.push("Add at least one photo.");
  if (d.description.trim().length < 20) out.push("Write a short description (a sentence or two).");
  return out;
}

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
  floorPlans: d.floorPlans.map(f => ({ ...f, image: f.image?.startsWith("blob:") ? undefined : f.image })),
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
    case "size": return d.type === "Land" ? Number(d.landValue) > 0 : Number(d.builtValue) > 0 || Number(d.landValue) > 0;
    case "photos": return d.photos.length > 0;
    case "amenities": return d.amenities.length + d.highlights.length > 0;
    case "plans": return d.floorPlans.length > 0;
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
  const [tab, setTab] = useState<"card" | "hot" | "page">("card");
  const items = [...highlights, ...amenities];
  return (
    <div className="flex flex-col gap-5">
      <Segmented value={tab} onChange={setTab} options={[
        { value: "card", label: "Card" }, { value: "hot", label: "Hot" }, { value: "page", label: "Page" },
      ]} />
      {tab === "card" && (
        <div className="mx-auto w-full max-w-[340px]">
          <ListingCard p={p} light showDetails />
          <p className="mt-3 text-[12px] text-center" style={{ color: MUTED_L, ...sans }}>As in New Listings and the Buy / Rent pages.</p>
        </div>
      )}
      {tab === "hot" && (
        <div className="mx-auto w-full max-w-[340px]">
          <HotCard p={p} />
          <p className="mt-3 text-[12px] text-center" style={{ color: MUTED_L, ...sans }}>{p.featured || p.badge === "Hot" ? "Shown in Hot Properties on the home page." : "Turn on Featured (or choose the Hot badge) to show it here."}</p>
        </div>
      )}
      {tab === "page" && (
        <div className="border p-5 flex flex-col gap-4" style={{ borderColor: BORDER_L, background: WHITE }}>
          <div className="flex flex-wrap gap-1.5"><Chip tone="maroon">{p.badge}</Chip><Chip tone="muted">{p.listing}</Chip></div>
          <div>
            <p className="text-[22px] leading-tight" style={{ color: FG_LIGHT, ...serif }}>{p.title}</p>
            <p className="flex items-center gap-1.5 mt-1.5 text-[13px]" style={{ color: MUTED_L, ...sans }}><MapPin size={12} style={{ color: GOLD }} />{p.location}</p>
            <p className="mt-2 text-[18px] font-medium" style={{ color: MAROON, ...sans }}>{p.price}</p>
          </div>
          <div className="pt-4 border-t" style={{ borderColor: BORDER_L }}>
            <p className="text-[10px] tracking-[0.28em] uppercase mb-3" style={{ color: GOLD, ...sans }}>Features & Amenities</p>
            {items.length === 0 ? (
              <p className="text-[13px]" style={{ color: MUTED_L, ...sans }}>Pick amenities in step 6 and they appear here with their icons.</p>
            ) : (
              <div className="grid grid-cols-2 gap-x-4">
                {items.slice(0, 10).map(f => {
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
            {items.length > 10 && <p className="mt-2 text-[12px]" style={{ color: MUTED_L, ...sans }}>and {items.length - 10} more</p>}
          </div>
          {plans > 0 && <p className="text-[12px]" style={{ color: MUTED_L, ...sans }}>Floor plan: {plans} floor{plans === 1 ? "" : "s"} shown on the page.</p>}
        </div>
      )}
    </div>
  );
}

/**
 * Where the pin sits on the Buy / Rent "Map" view. That map is an illustrative grid, not
 * real geography, so this is a simple click-to-place square (0–100 across and down).
 * For the backend: stored as mapX / mapY today; real lat / lng can replace it later (§6).
 */
function MapPinPicker({ x, y, onChange }: { x: number; y: number; onChange: (x: number, y: number) => void }) {
  const place = (e: React.MouseEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const pct = (v: number) => Math.round(Math.min(96, Math.max(4, v * 100)));
    onChange(pct((e.clientX - r.left) / r.width), pct((e.clientY - r.top) / r.height));
  };
  return (
    <div role="button" tabIndex={0} aria-label="Click to place the property on the map" onClick={place}
      className="relative w-full cursor-crosshair border overflow-hidden" style={{ aspectRatio: "16/7", borderColor: BORDER_L, background: "#f1ece3" }}>
      <svg className="absolute inset-0 w-full h-full" aria-hidden="true">
        <defs><pattern id="pe-grid" width="28" height="28" patternUnits="userSpaceOnUse"><path d="M28 0H0V28" fill="none" stroke="rgba(26,22,17,0.07)" /></pattern></defs>
        <rect width="100%" height="100%" fill="url(#pe-grid)" />
      </svg>
      <span className="absolute -translate-x-1/2 -translate-y-full transition-all duration-300" style={{ left: `${x}%`, top: `${y}%`, color: MAROON }}>
        <MapPin size={26} fill={MAROON} stroke={WHITE} strokeWidth={1.5} />
      </span>
      <span className="absolute bottom-2 right-3 text-[11px]" style={{ color: MUTED_L, ...sans }}>Click to move the pin</span>
    </div>
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
export function PropertyEditor({ property, template = null, open, onClose, onSaved, onViewOnSite }: {
  property: Prop | null; template?: Prop | null; open: boolean; onClose: () => void;
  onSaved: (message: string) => void; onViewOnSite: (id: number) => void;
}) {
  const start = (): Draft => template
    ? { ...toDraft(template), id: nextPropertyId(), propId: nextPropRef(), isNew: true, title: `${template.title} (copy)`, reactions: 0 }
    : toDraft(property ?? undefined);

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
    const saved = readDraft(draftKey(s));
    setRestore(saved && JSON.stringify({ ...saved, id: s.id, propId: s.propId }) !== JSON.stringify(withoutTempPhotos(s)) ? saved : null);
  }, [open, property, template]);

  const dirty = JSON.stringify(d) !== base;
  // Autosave a moment after typing stops.
  useEffect(() => {
    if (!open || !dirty) return;
    const t = window.setTimeout(() => writeDraft(draftKey(d), d), 700);
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
    title: d.title, type: d.type, listing: d.listing, location: d.location.trim() || d.district, district: d.district,
    facing: d.facing, roadAccess: assembled.roadAccess, beds: d.beds, baths: d.baths, floors: d.floors,
    builtArea: assembled.builtArea, landArea: assembled.landArea, amenities: d.amenities, highlights: d.highlights,
  };

  const close = () => { clearDraft(draftKey(d)); onClose(); };
  const save = () => {
    setTried(true);
    if (issues.length) return;
    saveProperty(toProp(d));
    setReactionCount(d.id, d.reactions);
    clearDraft(draftKey(d));
    onSaved(d.isNew ? `“${d.title.trim()}” added to the site` : `“${d.title.trim()}” updated`);
    onClose();
  };

  const footer = (
    <>
      {tried && issues.length > 0 && (
        <p className="sm:mr-auto text-[13px]" style={{ color: MAROON, ...sans }}>{issues[0]}{issues.length > 1 ? ` (+${issues.length - 1} more)` : ""}</p>
      )}
      {!d.isNew && <Button variant="quiet" onClick={() => onViewOnSite(d.id)}><Eye size={14} />View on Site</Button>}
      <Button onClick={save} title="Ctrl + S"><Check size={14} />{d.isNew ? "Publish Property" : "Save Changes"}</Button>
    </>
  );

  return (
    <Drawer open={open} onClose={close} backLabel="Back to Properties" dirty={dirty} onSave={save}
      title={template ? `Copy of ${template.title}` : d.isNew ? "Add a Property" : `Edit ${property?.title ?? "Property"}`}
      subtitle={`Reference ${d.propId} · Saved as a draft while you work · Ctrl + S to save`}
      headerExtra={<Progress d={d} />}
      preview={<PropertyPreview p={previewProp} amenities={d.amenities} highlights={d.highlights} plans={d.floorPlans.length} />}
      previewTitle="Live preview" footer={footer}>
      <div className="flex flex-col gap-6">
        {restore && (
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 border px-5 py-4" style={{ borderColor: "rgba(176,136,72,0.45)", background: "rgba(176,136,72,0.08)" }}>
            <History size={18} className="shrink-0" style={{ color: GOLD }} />
            <p className="flex-1 text-[14px] leading-relaxed" style={{ color: FG_LIGHT, ...sans }}>
              You have unsaved changes from earlier. Restore them? <span style={{ color: MUTED_L }}>(Photos picked before then need adding again.)</span>
            </p>
            <div className="flex gap-2 shrink-0">
              <Button variant="quiet" onClick={() => { clearDraft(draftKey(d)); setRestore(null); }}>Discard</Button>
              <Button onClick={() => { setD(o => ({ ...restore, id: o.id, propId: o.propId, isNew: o.isNew })); setRestore(null); }}>Restore</Button>
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
            <Field label="Listing"><Segmented value={d.listing} onChange={v => set("listing", v)} options={LISTINGS.map(l => ({ value: l, label: l }))} /></Field>
            <Field label="Property Type"><Select value={d.type} onChange={v => set("type", v)} options={PROPERTY_TYPES} /></Field>
            <Field label="Badge" hint="The coloured label on the photo."><Select value={d.badge} onChange={v => set("badge", v)} options={BADGES.includes(d.badge) ? BADGES : [d.badge, ...BADGES]} /></Field>
            <Field label="Short Tagline" hint="Optional.">
              <TextInput value={d.tagline} onChange={v => set("tagline", v)} maxLength={60} placeholder="e.g. Heritage Reimagined" />
              {!d.tagline && <IdeaChips label="Ideas" ideas={taglineIdeas(d.type).slice(0, 3)} onPick={v => set("tagline", v)} />}
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
            <Field label="Position on the Site Map" className="md:col-span-2" hint="Where the pin appears on the Buy / Rent map view.">
              <MapPinPicker x={d.mapX} y={d.mapY} onChange={(x, y) => setD(o => ({ ...o, mapX: x, mapY: y }))} />
            </Field>
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
            <div className="grid grid-cols-[1fr_7rem] gap-3">
              <Field label="Land Area"><TextInput value={d.landValue} onChange={v => set("landValue", v.replace(/[^\d.]/g, ""))} placeholder="e.g. 12" /></Field>
              <Field label="Unit"><Select value={d.landUnit} onChange={v => set("landUnit", v)} options={LAND_UNITS.includes(d.landUnit) ? LAND_UNITS : [d.landUnit, ...LAND_UNITS]} /></Field>
            </div>
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

        <FormSection id="pe-plans" n={7} title="Floor Plans" subtitle="Optional. One card per floor, with its drawing and rooms. Shown on the property page.">
          <FloorPlansEditor plans={d.floorPlans} onChange={v => set("floorPlans", v)} />
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

// ─── Floor plans ──────────────────────────────────────────────────────────────

/**
 * Room sizes are stored as "5.2 × 4.8 m". While typing, one side may still be empty
 * ("5.2 ×  m"), so both halves round-trip exactly; toProp() drops incomplete sizes.
 */
const splitDims = (s: string): [string, string] => {
  const m = s.match(/^\s*([\d.]*)\s*[×x]\s*([\d.]*)/i);
  return m ? [m[1], m[2]] : ["", ""];
};
const joinDims = (a: string, b: string) => (a || b ? `${a} × ${b} m` : "");
const completeDims = (s: string) => {
  const [a, b] = splitDims(s);
  return Number(a) > 0 && Number(b) > 0 ? `${a} × ${b} m` : "";
};

function FloorPlansEditor({ plans, onChange }: { plans: FloorPlan[]; onChange: (v: FloorPlan[]) => void }) {
  const update = (id: string, patch: Partial<FloorPlan>) => onChange(plans.map(p => (p.id === id ? { ...p, ...patch } : p)));
  const addFloor = () => {
    const label = FLOOR_LABELS.find(l => !plans.some(p => p.label === l)) ?? `Floor ${plans.length + 1}`;
    onChange([...plans, { id: `f${Date.now().toString(36)}`, label, rooms: [{ name: "Living Room", dims: "" }] }]);
  };
  return (
    <div className="flex flex-col gap-5">
      {plans.map(plan => (
        <div key={plan.id} className="border p-5" style={{ borderColor: BORDER_L, background: "#fbf9f5" }}>
          <div className="flex items-end gap-3 mb-5">
            <Field label="Floor" className="flex-1">
              <Select value={plan.label} onChange={v => update(plan.id, { label: v })} options={FLOOR_LABELS.includes(plan.label) ? FLOOR_LABELS : [plan.label, ...FLOOR_LABELS]} />
            </Field>
            <Button variant="quiet" title="Remove this floor" onClick={() => onChange(plans.filter(p => p.id !== plan.id))}><Trash2 size={14} />Remove</Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-[16rem_1fr] gap-5">
            <Field label="Drawing" hint="Optional image of the plan.">
              <ImageField value={plan.image ?? ""} onChange={url => update(plan.id, { image: url })} aspect="4/3" label="Upload plan" />
            </Field>
            <Field label="Rooms" hint="Sizes in metres, length × width.">
              <div className="flex flex-col gap-2">
                {plan.rooms.map((room, i) => {
                  const [a, b] = splitDims(room.dims);
                  const setRoom = (patch: Partial<typeof room>) => update(plan.id, { rooms: plan.rooms.map((r, k) => (k === i ? { ...r, ...patch } : r)) });
                  return (
                    <div key={i} className="grid grid-cols-[1fr_4.5rem_auto_4.5rem_auto] items-center gap-2">
                      <Select value={room.name} onChange={v => setRoom({ name: v })} options={ROOM_NAMES.includes(room.name) ? ROOM_NAMES : [room.name, ...ROOM_NAMES]} />
                      <TextInput value={a} onChange={v => setRoom({ dims: joinDims(v.replace(/[^\d.]/g, ""), b) })} placeholder="5.2" />
                      <span className="text-[13px]" style={{ color: MUTED_L }}>×</span>
                      <TextInput value={b} onChange={v => setRoom({ dims: joinDims(a, v.replace(/[^\d.]/g, "")) })} placeholder="4.8" />
                      <button type="button" aria-label="Remove room" onClick={() => update(plan.id, { rooms: plan.rooms.filter((_, k) => k !== i) })}
                        className="p-2 transition-colors hover:text-[#8a2030]" style={{ color: MUTED_L }}><X size={15} /></button>
                    </div>
                  );
                })}
                <button type="button" onClick={() => update(plan.id, { rooms: [...plan.rooms, { name: "Bedroom", dims: "" }] })}
                  className="self-start mt-1 inline-flex items-center gap-2 text-[11px] tracking-[0.2em] uppercase transition-colors hover:text-[#8a2030]" style={{ color: MAROON, ...sans }}>
                  <Plus size={13} />Add Room
                </button>
              </div>
            </Field>
          </div>
        </div>
      ))}
      <button type="button" onClick={addFloor}
        className="flex items-center justify-center gap-2 py-5 border border-dashed text-[11px] tracking-[0.24em] uppercase transition-colors hover:border-[#8a2030]"
        style={{ borderColor: "rgba(176,136,72,0.5)", color: FG_LIGHT, ...sans }}>
        <Plus size={15} style={{ color: GOLD }} />Add a Floor
      </button>
    </div>
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
