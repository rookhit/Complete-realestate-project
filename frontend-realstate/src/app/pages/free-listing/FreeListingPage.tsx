// The Free Listing page: a signed-in member sends their property for the team to review (it lands in
// Admin → Free Listings; nothing is published until the admin does it). The form follows the admin's
// Add Property: what it asks for depends on the property type (listing-fields.ts), the contact
// details start from the account, and everything typed or picked is kept on this device until it is
// sent (listing-draft.ts). Photos are stamped with the watermark as they upload (api/uploads.ts).
import { useRevealWhen } from "@/app/components/ui/reveal";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Check, CheckCircle2, ChevronDown, Lock, RotateCcw } from "lucide-react";
import { requestSignIn, useAuth, type AuthUser } from "@/app/auth";
import { submitListing, type ListingDetails } from "@/api/listings";
import { uploadListingPhoto } from "@/api/uploads";
import { BUILT_UNITS, FACINGS, LAND_UNITS, PROPERTY_TYPES, RAPD, ROAD_SURFACES, isRapd, normalizeRapd, rapdProblem, rapdToSqft } from "@/app/data/properties";
import { BG_LIGHT, BORDER_L, CREAM, FG_LIGHT, GOLD, MAROON, MUTED_L, WHITE, sans, serif } from "@/app/components/ui/brand";
import { DistrictCombobox } from "@/app/components/ui/district-combobox";
import { ImageUpload, type PickedImage } from "@/app/components/ui/image-upload";
import { ConfirmDialog } from "@/app/components/ui/confirm-dialog";
import { GoldLine, Tag } from "@/app/components/ui/typography";
import { sendError } from "@/app/components/ui/send-error";
import { LegalConsent } from "@/app/components/ui/legal-consent";
import { SIZE_FIELDS, amenityFits, amenityGroupsFor, kindOf } from "./listing-fields";
import { clearDraft, loadDraftFields, loadDraftPhotos, saveDraftFields, saveDraftPhotos } from "./listing-draft";

/** Everything on the form, as typed (numbers stay text until sending, so a field can be empty). */
type Form = {
  title: string; listing: "For Sale" | "For Rent"; type: string;
  district: string; address: string; mapUrl: string;
  price: string;
  landValue: string; landUnit: string; builtValue: string; builtUnit: string;
  bedrooms: string; bathrooms: string; floors: string; buildYear: string;
  facing: string; roadSurface: string; roadWidth: string;
  amenities: string[]; description: string;
  sellerName: string; sellerPhone: string; sellerEmail: string;
};
type FieldKey = keyof Form | "photos";

const blankForm = (): Form => ({
  title: "", listing: "For Sale", type: PROPERTY_TYPES[0] ?? "House/Bungalow",
  district: "", address: "", mapUrl: "", price: "",
  landValue: "", landUnit: LAND_UNITS[0] ?? "Ropani", builtValue: "", builtUnit: BUILT_UNITS[0] ?? "sq.ft",
  bedrooms: "", bathrooms: "", floors: "", buildYear: "",
  facing: "", roadSurface: "", roadWidth: "",
  amenities: [], description: "",
  sellerName: "", sellerPhone: "", sellerEmail: "",
});

/** Fills the contact fields the seller hasn't typed from their account. */
const withAccount = (f: Form, u: AuthUser): Form => ({
  ...f,
  sellerName: f.sellerName || u.name || "",
  sellerPhone: f.sellerPhone || u.phone || "",
  sellerEmail: f.sellerEmail || u.email || "",
});

const THIS_YEAR = new Date().getFullYear();
const whole = (v: string): number | null => (v.trim() === "" ? null : Number(v));

/** The first problem with the form (and which field it is), or null when it can be sent. */
function problem(f: Form, photos: number): { field: FieldKey; message: string } | null {
  const show = SIZE_FIELDS[kindOf(f.type)];
  const count = (v: string, max: number) => v.trim() !== "" && !(Number.isInteger(Number(v)) && Number(v) >= 0 && Number(v) <= max);
  if (f.title.trim().length < 3) return { field: "title", message: "Please give the property a title (at least 3 characters)." };
  if (!f.district.trim()) return { field: "district", message: "Please choose the district." };
  if (f.mapUrl.trim() && !/^https:\/\/\S+$/i.test(f.mapUrl.trim())) return { field: "mapUrl", message: "The map link should start with https:// (copy it from Google Maps → Share)." };
  if (show.land && f.landUnit === RAPD && f.landValue.trim()) {
    if (!isRapd(f.landValue)) return { field: "landValue", message: "Write the land area as Ropani-Aana-Paisa-Dam, e.g. 4-4-0-1." };
    const why = rapdProblem(f.landValue);
    if (why) return { field: "landValue", message: why };
  }
  if (show.rooms && count(f.bedrooms, 50)) return { field: "bedrooms", message: "Check the number of bedrooms." };
  if (show.rooms && count(f.bathrooms, 50)) return { field: "bathrooms", message: "Check the number of bathrooms." };
  if (show.floors && count(f.floors, 60)) return { field: "floors", message: "Check the number of floors." };
  if (show.buildYear && f.buildYear.trim() && !(Number(f.buildYear) >= 1900 && Number(f.buildYear) <= THIS_YEAR + 2)) return { field: "buildYear", message: "Check the build year." };
  if (f.roadWidth.trim() && !(Number(f.roadWidth) >= 0 && Number(f.roadWidth) <= 300)) return { field: "roadWidth", message: "Check the road width (in feet)." };
  if (photos === 0) return { field: "photos", message: "Please add at least one photo: listings with photos get far more enquiries." };
  if (f.sellerName.trim().length < 2) return { field: "sellerName", message: "Please fill in your name." };
  if (!/^\+?[\d\s()-]{6,30}$/.test(f.sellerPhone.trim())) return { field: "sellerPhone", message: "Please check your phone number." };
  if (f.sellerEmail.trim() && !/^\S+@\S+\.\S+$/.test(f.sellerEmail.trim())) return { field: "sellerEmail", message: "Please check your email address." };
  return null;
}

// ─── Small pieces in the site's form style ─────────────────────────────────────

const inputCls = "w-full border px-3 py-3 text-[15px] outline-none transition-all focus:border-[#8a2030]";
const borderFor = (bad: boolean) => (bad ? MAROON : BORDER_L);

function Label({ children, htmlFor }: { children: ReactNode; htmlFor?: string }) {
  return <label htmlFor={htmlFor} className="text-[10px] tracking-[0.28em] uppercase" style={{ color: MUTED_L, ...sans }}>{children}</label>;
}
function Hint({ children }: { children: ReactNode }) {
  return <span className="text-[12px] leading-snug" style={{ color: MUTED_L, ...sans }}>{children}</span>;
}
function Section({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <section className="mt-8 pt-8 border-t first:mt-0 first:pt-0 first:border-t-0" style={{ borderColor: BORDER_L }}>
      <div className="flex items-baseline justify-between gap-3 mb-5">
        <h2 className="text-[11px] tracking-[0.3em] uppercase" style={{ color: GOLD, ...sans }}>{title}</h2>
        {note && <span className="text-[12px] text-right" style={{ color: MUTED_L, ...sans }}>{note}</span>}
      </div>
      {children}
    </section>
  );
}
function TextField({ id, label, value, onChange, placeholder, type = "text", hint, bad, inputMode }: {
  id: string; label: string; value: string; onChange: (v: string) => void; placeholder?: string;
  type?: string; hint?: ReactNode; bad?: boolean; inputMode?: "numeric" | "decimal" | "tel" | "email" | "url";
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <input id={id} type={type} inputMode={inputMode} placeholder={placeholder} value={value} onChange={e => onChange(e.target.value)}
        aria-invalid={bad || undefined} className={inputCls} style={{ borderColor: borderFor(!!bad), color: FG_LIGHT, ...sans }} />
      {hint && <Hint>{hint}</Hint>}
    </div>
  );
}
function SelectField({ id, label, value, onChange, options, empty }: {
  id: string; label: string; value: string; onChange: (v: string) => void; options: string[]; empty?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <select id={id} value={value} onChange={e => onChange(e.target.value)} className={`${inputCls} appearance-none cursor-pointer pr-9`} style={{ borderColor: BORDER_L, color: FG_LIGHT, background: WHITE, ...sans }}>
          {empty !== undefined && <option value="">{empty}</option>}
          {options.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
        <ChevronDown size={15} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: MUTED_L }} />
      </div>
    </div>
  );
}
/** A number plus its unit, e.g. land area "8" + "Ropani". */
function AreaField({ id, label, value, unit, units, onValue, onUnit, placeholder, hint, bad }: {
  id: string; label: string; value: string; unit: string; units: string[]; onValue: (v: string) => void; onUnit: (u: string) => void;
  placeholder: string; hint?: ReactNode; bad?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex">
        <input id={id} value={value} onChange={e => onValue(e.target.value)} placeholder={placeholder} aria-invalid={bad || undefined}
          className={`${inputCls} min-w-0`} style={{ borderColor: borderFor(!!bad), color: FG_LIGHT, ...sans }} />
        <div className="relative shrink-0">
          <select aria-label={`${label} unit`} value={unit} onChange={e => onUnit(e.target.value)} className="h-full border border-l-0 pl-3 pr-8 text-[14px] outline-none appearance-none cursor-pointer" style={{ borderColor: BORDER_L, color: FG_LIGHT, background: CREAM, ...sans }}>
            {units.map(u => <option key={u} value={u}>{u}</option>)}
          </select>
          <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: MUTED_L }} />
        </div>
      </div>
      {hint && <Hint>{hint}</Hint>}
    </div>
  );
}

// ─── The page ──────────────────────────────────────────────────────────────────

export function FreeListingPage({ onCreateAccount }: { onCreateAccount: () => void }) {
  const { user, status } = useAuth();
  const [form, setForm] = useState<Form>(blankForm);
  const [images, setImages] = useState<PickedImage[]>([]);
  /** The account whose draft has been loaded: nothing is saved before that, or it would overwrite it. */
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const [err, setErr] = useState<{ field: FieldKey | null; message: string } | null>(null);
  const [done, setDone] = useState<{ title: string; district: string; photos: number; name: string } | null>(null);
  const doneRef = useRevealWhen<HTMLDivElement>(done !== null);
  const [sending, setSending] = useState("");
  const [confirmClear, setConfirmClear] = useState(false);
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm(f => ({ ...f, [k]: v }));
  const kind = kindOf(form.type);
  const show = SIZE_FIELDS[kind];
  const bad = (k: FieldKey) => err?.field === k;

  // Signed in: bring back this account's draft (fields at once, photos from IndexedDB), and fill
  // the contact details the seller hasn't typed from the account.
  const userId = user?.id ?? null;
  useEffect(() => {
    if (!user) return;
    let alive = true;
    const saved = loadDraftFields<Partial<Form>>(user.id);
    setForm(withAccount({ ...blankForm(), ...saved }, user));
    void loadDraftPhotos(user.id).then(photos => {
      if (!alive) { photos.forEach(p => URL.revokeObjectURL(p.url)); return; }
      setImages(old => { old.forEach(p => URL.revokeObjectURL(p.url)); return photos; });
      setLoadedFor(user.id);
    });
    return () => { alive = false; };
    // Only when the account changes, not on every render of the same user object.
  }, [userId]);

  // Keep the draft as it changes (fields shortly after typing stops; photos when added or removed).
  useEffect(() => {
    if (!userId || loadedFor !== userId || done) return;
    const t = setTimeout(() => saveDraftFields(userId, form), 300);
    return () => clearTimeout(t);
  }, [form, userId, loadedFor, done]);
  useEffect(() => {
    if (userId && loadedFor === userId && !done) void saveDraftPhotos(userId, images);
  }, [images, userId, loadedFor, done]);

  // A changed type drops the ticks that don't fit it (e.g. "Sofa" when switching to Land).
  const setType = (type: string) => setForm(f => ({ ...f, type, amenities: f.amenities.filter(a => amenityFits(kindOf(type), a)) }));
  const toggleAmenity = (name: string) => set("amenities", form.amenities.includes(name) ? form.amenities.filter(a => a !== name) : [...form.amenities, name]);

  const errorBox = useRef<HTMLParagraphElement>(null);
  const fail = (field: FieldKey | null, message: string) => {
    setErr({ field, message });
    requestAnimationFrame(() => {
      const el = field ? document.getElementById(`fl-${field}`) : null;
      (el ?? errorBox.current)?.scrollIntoView({ behavior: "smooth", block: "center" });
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) el.focus({ preventScroll: true });
    });
  };

  const submit = async () => {
    if (sending || !user) return;
    const p = problem(form, images.length);
    if (p) { fail(p.field, p.message); return; }
    setErr(null);
    const f = form;
    const details: ListingDetails = {
      address: f.address.trim(), mapUrl: f.mapUrl.trim(),
      bedrooms: show.rooms ? whole(f.bedrooms) : null, bathrooms: show.rooms ? whole(f.bathrooms) : null,
      floors: show.floors ? whole(f.floors) : null,
      facing: f.facing, roadSurface: f.roadSurface, roadWidthFt: whole(f.roadWidth),
    };
    const land = !show.land || !f.landValue.trim() ? "" : f.landUnit === RAPD ? normalizeRapd(f.landValue) : `${f.landValue.trim()} ${f.landUnit}`;
    const built = !show.built || !f.builtValue.trim() ? "" : `${f.builtValue.trim()} ${f.builtUnit}`;
    try {
      // Photos first, one at a time and in order (the first is the cover), then the listing.
      const photos: string[] = [];
      for (const [i, img] of images.entries()) {
        setSending(`Uploading photo ${i + 1} of ${images.length}…`);
        photos.push(await uploadListingPhoto(img.file));
      }
      setSending("Sending your listing…");
      await submitListing({
        sellerName: f.sellerName.trim(), sellerPhone: f.sellerPhone.trim(), sellerEmail: f.sellerEmail.trim(),
        title: f.title.trim(), listing: f.listing, type: f.type, district: f.district,
        price: f.price.trim(), builtArea: built, landArea: land, buildYear: show.buildYear ? f.buildYear.trim() : "",
        description: f.description.trim(), details,
        amenities: f.amenities.filter(a => amenityFits(kind, a)), photos,
      });
      await clearDraft(user.id);
      setDone({ title: f.title.trim(), district: f.district, photos: images.length, name: f.sellerName.trim() });
    } catch (e) {
      fail(null, sendError(e));
    } finally {
      setSending("");
    }
  };

  /** Back to an empty form (contact details from the account again), and forget the draft. */
  const startOver = () => {
    images.forEach(p => URL.revokeObjectURL(p.url));
    setImages([]);
    setForm(user ? withAccount(blankForm(), user) : blankForm());
    setErr(null); setDone(null);
    if (user) void clearDraft(user.id);
  };

  const rapdSqft = show.land && form.landUnit === RAPD && isRapd(form.landValue) && !rapdProblem(form.landValue)
    ? `≈ ${rapdToSqft(form.landValue).toLocaleString("en-US")} sq.ft` : null;

  return (
    <div className="min-h-screen pt-20" style={{ background: BG_LIGHT }}>
      <div className="px-6 md:px-12 lg:px-20 py-16 md:py-20 border-b" style={{ borderColor: BORDER_L, background: WHITE }}>
        <div className="flex items-center gap-3 mb-4"><GoldLine /><Tag c={GOLD}>List Your Property</Tag></div>
        <h1 className="leading-[0.92]" style={{ color: FG_LIGHT, ...serif, fontSize: "clamp(2rem,4vw,3.5rem)" }}>Free Property Listing</h1>
        <p className="mt-3 text-[15px]" style={{ color: MUTED_L, ...sans }}>Reach Nepal&apos;s most discerning buyers and renters. List your property with Nepal Bhoomi at no charge.</p>
      </div>

      <div className="px-6 md:px-12 lg:px-20 py-16 grid grid-cols-1 lg:grid-cols-3 gap-10">
        <div className="lg:col-span-2 border p-6 sm:p-8" style={{ background: WHITE, borderColor: BORDER_L }}>
          {!user ? (
            <div className="flex flex-col items-center text-center gap-4 py-16">
              <Lock size={32} style={{ color: GOLD }} />
              <h2 className="text-2xl" style={{ color: FG_LIGHT, ...serif }}>{status === "loading" ? "Checking your account…" : "Log in to list your property"}</h2>
              {status !== "loading" && <>
                <p className="text-[15px] leading-relaxed max-w-md" style={{ color: MUTED_L, ...sans }}>
                  Free listings are for members, so our team knows who sent each property. It takes a minute to create an account.
                </p>
                <div className="flex flex-wrap justify-center gap-3 mt-2">
                  <button onClick={requestSignIn} className="px-8 py-4 text-[11px] tracking-[0.25em] uppercase transition-all hover:brightness-110" style={{ background: MAROON, color: WHITE, ...sans }}>Log In</button>
                  <button onClick={onCreateAccount} className="px-8 py-4 border text-[11px] tracking-[0.25em] uppercase transition-all hover:border-[#8a2030]" style={{ borderColor: BORDER_L, color: FG_LIGHT, ...sans }}>Create Account</button>
                </div>
              </>}
            </div>
          ) : done ? (
            <div ref={doneRef} className="flex flex-col items-center text-center gap-4 py-16">
              <CheckCircle2 size={36} style={{ color: GOLD }} />
              <h2 className="text-2xl" style={{ color: FG_LIGHT, ...serif }}>Listing submitted</h2>
              <p className="text-[15px] leading-relaxed max-w-md" style={{ color: MUTED_L, ...sans }}>
                Thank you. Our listings team will review {done.title} in {done.district} with {done.photos} photo{done.photos === 1 ? "" : "s"} and contact {done.name} within one working day.
              </p>
              <button onClick={startOver} className="mt-2 px-8 py-4 text-[11px] tracking-[0.25em] uppercase transition-all hover:brightness-110" style={{ background: MAROON, color: WHITE, ...sans }}>Submit Another</button>
            </div>
          ) : (<>
            <Section title="The Property">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div className="flex flex-col gap-1.5">
                  <Label>Listing</Label>
                  <div className="grid grid-cols-2" role="radiogroup" aria-label="Listing">
                    {(["For Sale", "For Rent"] as const).map(l => (
                      <button key={l} type="button" role="radio" aria-checked={form.listing === l} onClick={() => set("listing", l)}
                        className="py-3 border text-[12px] tracking-[0.18em] uppercase transition-all first:border-r-0"
                        style={{ borderColor: form.listing === l ? FG_LIGHT : BORDER_L, background: form.listing === l ? FG_LIGHT : WHITE, color: form.listing === l ? WHITE : FG_LIGHT, ...sans }}>{l}</button>
                    ))}
                  </div>
                </div>
                <SelectField id="fl-type" label="Property Type" value={form.type} onChange={setType} options={PROPERTY_TYPES} />
                <div className="sm:col-span-2">
                  <TextField id="fl-title" label="Property Title" value={form.title} onChange={v => set("title", v)} bad={bad("title")}
                    placeholder={kind === "land" ? "e.g. 12 Aana Land in Budhanilkantha" : kind === "commercial" ? "e.g. Office Floor in Lazimpat" : "e.g. 5-Bedroom House in Patan"} />
                </div>
              </div>
            </Section>

            <Section title="Location">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div id="fl-district" className="flex flex-col gap-1.5">
                  <Label>District</Label>
                  <div style={bad("district") ? { outline: `1px solid ${MAROON}` } : undefined}>
                    <DistrictCombobox value={form.district} onChange={v => set("district", v)} placeholder="Type to search all 77 districts" />
                  </div>
                </div>
                <TextField id="fl-address" label="Area / Street" value={form.address} onChange={v => set("address", v)} placeholder="e.g. Jhamsikhel, Lalitpur" />
                <div className="sm:col-span-2">
                  <TextField id="fl-mapUrl" label="Google Maps Link (optional)" type="url" inputMode="url" value={form.mapUrl} onChange={v => set("mapUrl", v)} bad={bad("mapUrl")}
                    placeholder="https://maps.app.goo.gl/…" hint="Only our team sees this; the website never shows a property's exact spot. In Google Maps: drop a pin, then Share → Copy link." />
                </div>
              </div>
            </Section>

            <Section title="Price">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <TextField id="fl-price" label={form.listing === "For Rent" ? "Monthly Rent (NPR)" : "Asking Price (NPR)"} value={form.price} onChange={v => set("price", v)}
                  placeholder={form.listing === "For Rent" ? "e.g. 85,000" : "e.g. 5,00,00,000 or 5 crore"} hint="Leave it empty to show “Negotiable”." />
              </div>
            </Section>

            <Section title={kind === "land" ? "Land Size" : show.rooms ? "Size & Rooms" : "Size"}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                {show.land && (
                  <AreaField id="fl-landValue" label="Land Area" value={form.landValue} unit={form.landUnit} units={[...LAND_UNITS, RAPD]}
                    onValue={v => set("landValue", v)} onUnit={u => set("landUnit", u)} bad={bad("landValue")}
                    placeholder={form.landUnit === RAPD ? "e.g. 4-4-0-1" : "e.g. 8"}
                    hint={form.landUnit === RAPD ? rapdSqft ?? "Ropani-Aana-Paisa-Dam, e.g. 4-4-0-1." : undefined} />
                )}
                {show.built && (
                  <AreaField id="fl-builtValue" label="Built-up Area" value={form.builtValue} unit={form.builtUnit} units={BUILT_UNITS}
                    onValue={v => set("builtValue", v)} onUnit={u => set("builtUnit", u)} placeholder="e.g. 3,500" />
                )}
                {show.rooms && <>
                  <TextField id="fl-bedrooms" label="Bedrooms" type="number" inputMode="numeric" value={form.bedrooms} onChange={v => set("bedrooms", v)} bad={bad("bedrooms")} placeholder="e.g. 4" />
                  <TextField id="fl-bathrooms" label="Bathrooms" type="number" inputMode="numeric" value={form.bathrooms} onChange={v => set("bathrooms", v)} bad={bad("bathrooms")} placeholder="e.g. 3" />
                </>}
                {show.floors && <TextField id="fl-floors" label={kind === "apartment" ? "Floors in the Building" : "Floors"} type="number" inputMode="numeric" value={form.floors} onChange={v => set("floors", v)} bad={bad("floors")} placeholder="e.g. 3" />}
                {show.buildYear && <TextField id="fl-buildYear" label="Build Year" type="number" inputMode="numeric" value={form.buildYear} onChange={v => set("buildYear", v)} bad={bad("buildYear")} placeholder={`e.g. ${THIS_YEAR - 3}`} />}
              </div>
            </Section>

            <Section title="Road & Facing">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                <SelectField id="fl-facing" label="Facing" value={form.facing} onChange={v => set("facing", v)} options={FACINGS} empty="Not sure" />
                <SelectField id="fl-roadSurface" label="Road Surface" value={form.roadSurface} onChange={v => set("roadSurface", v)} options={ROAD_SURFACES} empty="Not sure" />
                <TextField id="fl-roadWidth" label="Road Width (ft)" type="number" inputMode="decimal" value={form.roadWidth} onChange={v => set("roadWidth", v)} bad={bad("roadWidth")} placeholder="e.g. 20" />
              </div>
            </Section>

            <Section title={kind === "land" ? "Land Features" : "Amenities"} note={`${form.amenities.length} selected`}>
              {amenityGroupsFor(kind).map(({ group, label, items }) => (
                <div key={group} className="mb-6 last:mb-0">
                  {!(kind === "land") && <p className="text-[10px] tracking-[0.24em] uppercase mb-3" style={{ color: MUTED_L, ...sans }}>{label}</p>}
                  <div className="flex flex-wrap gap-2">
                    {items.map(({ name, Icon }) => {
                      const on = form.amenities.includes(name);
                      return (
                        <button key={name} type="button" onClick={() => toggleAmenity(name)} aria-pressed={on}
                          className="flex items-center gap-2 px-3.5 py-2.5 border text-[13px] transition-all"
                          style={{ borderColor: on ? MAROON : BORDER_L, background: on ? "rgba(138,32,48,0.06)" : "transparent", color: on ? MAROON : MUTED_L, ...sans }}>
                          <Icon size={17} />{name}{on && <Check size={13} />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </Section>

            <Section title="Photos" note="The first photo becomes the cover">
              <div id="fl-photos" style={bad("photos") ? { outline: `1px solid ${MAROON}`, outlineOffset: 4 } : undefined}>
                <ImageUpload images={images} onChange={setImages} />
              </div>
            </Section>

            <Section title="Description">
              <textarea id="fl-description" rows={5} value={form.description} onChange={e => set("description", e.target.value)}
                className={`${inputCls} resize-y`} style={{ borderColor: BORDER_L, color: FG_LIGHT, ...sans }}
                placeholder={kind === "land" ? "Shape of the plot, what's nearby, access, water and electricity…" : "What makes it special: layout, condition, views, neighbourhood…"} />
            </Section>

            <Section title="Your Contact Details" note="Only our team sees these">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <TextField id="fl-sellerName" label="Contact Name" value={form.sellerName} onChange={v => set("sellerName", v)} bad={bad("sellerName")} placeholder="Your name" />
                <TextField id="fl-sellerPhone" label="Contact Phone" type="tel" inputMode="tel" value={form.sellerPhone} onChange={v => set("sellerPhone", v)} bad={bad("sellerPhone")} placeholder="+977 98…" />
                <TextField id="fl-sellerEmail" label="Contact Email" type="email" inputMode="email" value={form.sellerEmail} onChange={v => set("sellerEmail", v)} bad={bad("sellerEmail")} placeholder="your@email.com" />
              </div>
              <p className="mt-3"><Hint>Filled in from your account; change them if this listing has a different contact.</Hint></p>
            </Section>

            {err && <p ref={errorBox} role="alert" className="mt-6 text-[14px]" style={{ color: MAROON, ...sans }}>{err.message}</p>}
            <button onClick={() => void submit()} disabled={!!sending} className="mt-6 w-full py-4 text-[12px] tracking-[0.25em] uppercase transition-all hover:brightness-110 disabled:opacity-60" style={{ background: MAROON, color: WHITE, ...sans }}>{sending || "Submit Free Listing"}</button>
            <div className="mt-3"><LegalConsent action="submitting this listing" /></div>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <Hint>Your progress is saved on this device until you submit (logging out clears it).</Hint>
              <button type="button" onClick={() => setConfirmClear(true)} disabled={!!sending} className="flex items-center gap-1.5 text-[12px] tracking-[0.12em] uppercase transition-colors hover:text-[#8a2030] disabled:opacity-50" style={{ color: MUTED_L, ...sans }}>
                <RotateCcw size={13} />Clear form
              </button>
            </div>
          </>)}
        </div>

        <div className="flex flex-col gap-5">
          <div className="border p-6" style={{ background: CREAM, borderColor: BORDER_L }}>
            <p className="text-[11px] tracking-[0.3em] uppercase mb-4" style={{ color: GOLD, ...sans }}>Why List With Us?</p>
            {["Free to list", "Reach premium buyers", "Professional presentation", "Verified listing badge", "Agent follow-up support"].map(b => (
              <div key={b} className="flex items-center gap-3 py-3 border-b" style={{ borderColor: BORDER_L }}>
                <div className="w-5 h-5 flex items-center justify-center shrink-0" style={{ background: "rgba(138,32,48,0.1)", color: MAROON }}><CheckCircle2 size={15} /></div>
                <span className="text-[14px]" style={{ color: MUTED_L, ...sans }}>{b}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <ConfirmDialog open={confirmClear} title="Clear the form?" message="Everything you've typed and the photos you picked will be removed from this device."
        confirmLabel="Clear form" onConfirm={() => { setConfirmClear(false); startOver(); }} onCancel={() => setConfirmClear(false)} />
    </div>
  );
}
