import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, Clock, CopyPlus, Download, ExternalLink, Eye, ImageOff, Lock, Mail, MapPin, MessageCircle, Phone, Undo2, X } from "lucide-react";
import { LISTINGS, listingGaps, listingToProp, listingsLoaded, onListingSaveFailed, type ListingSubmission } from "@/app/data/listings";
import { exactFor, placeLabel } from "@/app/data/maps";
import { landSqftNote } from "@/app/data/properties";
import { timeAgo } from "@/app/data/messages";
import { useDataVersion } from "@/app/data/store";
import { amenityIcon } from "@/app/icons/amenities";
import { AreaMap } from "@/app/components/ui/maps";
import { BG_LIGHT, BORDER_L, CREAM, FG_LIGHT, GOLD, MAROON, MUTED_L, WHITE, sans, serif } from "@/app/components/ui/brand";
import logoImg from "@/imports/image.png";
import { AdminLayout, type AdminNav } from "./AdminLayout";
import { StatusPill, isOnSite, propertyRemoved, useListingActions } from "./listing-actions";
import { useToast } from "./parts";

import { cardSrc, fullPhotoOnError } from "@/app/components/ui/card-photo";
/** Everything the seller told us, as label / value pairs (empty values are left out). */
function factsOf(l: ListingSubmission): [string, string][] {
  const p = listingToProp(l);
  const d = l.details;
  const sqft = landSqftNote(p.landArea);
  const facts: [string, string][] = [
    ["Listing", l.listing], ["Property type", l.type],
    ["Price asked", p.price ? `${p.price}${l.price.trim() && l.price.trim() !== p.price ? `  (typed: ${l.price.trim()})` : ""}` : "Negotiable"],
    ["Land area", p.landArea !== "—" ? `${p.landArea}${sqft ? `  ${sqft}` : ""}` : ""],
    ["Built-up area", p.builtArea !== "—" ? p.builtArea : ""],
    ["Bedrooms", d?.bedrooms != null ? String(d.bedrooms) : ""], ["Bathrooms", d?.bathrooms != null ? String(d.bathrooms) : ""],
    ["Floors", d?.floors != null ? String(d.floors) : ""], ["Build year", l.buildYear],
    ["Facing", d?.facing ?? ""], ["Road", p.roadAccess],
    ["Area / street", d?.address ?? ""], ["District", l.district],
  ];
  return facts.filter(([, v]) => v.trim() !== "");
}

const longDate = (iso: string) => new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "long", year: "numeric", hour: "numeric", minute: "2-digit" });
const digits = (phone: string) => phone.replace(/[^\d]/g, "");

function Gallery({ photos, title }: { photos: string[]; title: string }) {
  const [i, setI] = useState(0);
  const n = photos.length;
  useEffect(() => { setI(0); }, [photos.join("|")]);
  if (!n) return (
    <div className="flex flex-col items-center justify-center gap-2 aspect-[16/10] text-[13px]" style={{ background: "#0d0c0a", color: "rgba(240,235,224,0.6)", ...sans }}>
      <ImageOff size={26} style={{ color: GOLD }} />The seller sent no photos
    </div>
  );
  return (
    <div>
      <div className="relative aspect-[16/10]" style={{ background: "#0d0c0a" }}>
        <img src={photos[i]} alt={`${title}, photo ${i + 1} of ${n}`} className="absolute inset-0 w-full h-full object-contain" />
        <span className="absolute left-4 top-4 px-2.5 py-1 text-[11px] tracking-[0.12em] tabular-nums" style={{ background: "rgba(0,0,0,0.55)", color: WHITE, ...sans }}>{i + 1} / {n}</span>
        {n > 1 && <>
          <button type="button" onClick={() => setI(x => (x - 1 + n) % n)} aria-label="Previous photo" className="absolute left-3 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full flex items-center justify-center transition-colors hover:bg-black/70" style={{ background: "rgba(0,0,0,0.45)", color: WHITE }}><ChevronLeft size={20} /></button>
          <button type="button" onClick={() => setI(x => (x + 1) % n)} aria-label="Next photo" className="absolute right-3 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full flex items-center justify-center transition-colors hover:bg-black/70" style={{ background: "rgba(0,0,0,0.45)", color: WHITE }}><ChevronRight size={20} /></button>
        </>}
      </div>
      {n > 1 && (
        <div className="flex gap-2 mt-2 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
          {photos.map((src, k) => (
            <button key={src + k} type="button" onClick={() => setI(k)} aria-label={`Show photo ${k + 1}`} className="shrink-0 w-24 h-16 overflow-hidden border-2 transition-opacity"
              style={{ borderColor: k === i ? GOLD : "transparent", opacity: k === i ? 1 : 0.6 }}>
              <img src={cardSrc(src)} onError={fullPhotoOnError(src)} alt="" className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Heading({ children }: { children: ReactNode }) {
  return <p className="text-[11px] tracking-[0.3em] uppercase mb-4" style={{ color: GOLD, ...sans }}>{children}</p>;
}

// ─── The printable version (Download PDF) ──────────────────────────────────────
// A separate A4 layout in the site's colours, rendered into <body> and shown only when printing:
// the browser's "Save as PDF" keeps real text and the photos (a PDF library couldn't read the
// photos, which our storage serves without cross-site access).

const PRINT_CSS = `
@media screen { #nb-print-doc { display: none !important; } }
@media print {
  @page { size: A4; margin: 12mm; }
  html, body { background: #ffffff !important; }
  body > *:not(#nb-print-doc) { display: none !important; }
  #nb-print-doc { display: block !important; color: #1a1611; font-family: Jost, Arial, Helvetica, sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  #nb-print-doc .avoid { break-inside: avoid; }
}`;

function PrintDocument({ l }: { l: ListingSubmission }) {
  const facts = factsOf(l);
  const map = l.details?.mapUrl ?? "";
  const point = map ? exactFor({ mapUrl: map }) : null;
  return createPortal(
    <div id="nb-print-doc">
      <div style={{ background: "#0a0908", color: "#f0ebe0", padding: "14px 18px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <img src={logoImg} alt="" style={{ width: 40, height: 40, objectFit: "contain", background: "#fff" }} />
          <div>
            <div style={{ fontSize: 13, letterSpacing: "0.3em", textTransform: "uppercase" }}>Nepal Bhoomi</div>
            <div style={{ fontSize: 8, letterSpacing: "0.3em", textTransform: "uppercase", color: GOLD }}>Real Estate · Lazimpat, Kathmandu</div>
          </div>
        </div>
        <div style={{ textAlign: "right", fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase" }}>
          <div style={{ color: GOLD }}>Free listing #{l.id}</div>
          <div style={{ color: "#bdb4a4" }}>Received {longDate(l.receivedAt)}</div>
        </div>
      </div>
      <div style={{ height: 2, background: MAROON }} />

      <h1 style={{ fontFamily: "Gloock, Georgia, serif", fontSize: 26, lineHeight: 1.15, margin: "16px 0 4px", fontWeight: 400 }}>{l.title || "Untitled"}</h1>
      <div style={{ fontSize: 11, color: MUTED_L }}>{l.type} · {l.listing} · {placeLabel(l.details?.address ?? "", l.district)}</div>
      <div style={{ fontSize: 18, color: MAROON, fontWeight: 600, margin: "6px 0 12px" }}>{listingToProp(l).price || "Negotiable"}</div>

      {/* Who to call and where it is first: always on page one, however long the description. */}
      <div className="avoid" style={{ marginBottom: 12, display: "grid", gridTemplateColumns: map ? "1fr 1fr" : "1fr", gap: 12 }}>
        <div style={{ border: "1px solid rgba(176,136,72,0.6)", background: "rgba(176,136,72,0.08)", padding: "10px 12px" }}>
          <div style={{ fontSize: 8.5, letterSpacing: "0.3em", textTransform: "uppercase", color: GOLD, marginBottom: 6 }}>Owner · private</div>
          <div style={{ fontSize: 12 }}>{l.seller.name}</div>
          <div style={{ fontSize: 10.5, color: MUTED_L }}>{l.seller.phone}{l.seller.email ? ` · ${l.seller.email}` : ""}</div>
          {l.account && <div style={{ fontSize: 9, color: MUTED_L, marginTop: 3 }}>Sent from the account {l.account.email}</div>}
        </div>
        {map && (
          <div style={{ border: `1px solid ${BORDER_L}`, padding: "10px 12px" }}>
            <div style={{ fontSize: 8.5, letterSpacing: "0.3em", textTransform: "uppercase", color: GOLD, marginBottom: 6 }}>Location (team only)</div>
            {point && <div style={{ fontSize: 10.5 }}>{point.lat.toFixed(5)}, {point.lng.toFixed(5)}</div>}
            <div style={{ fontSize: 9, color: MUTED_L, wordBreak: "break-all", marginTop: 3 }}>{map}</div>
          </div>
        )}
      </div>

      {l.photos[0] && <img className="avoid" src={l.photos[0]} alt="" loading="eager" style={{ width: "100%", height: "72mm", objectFit: "cover", display: "block" }} />}
      {l.photos.length > 1 && (
        <div className="avoid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6, marginTop: 6 }}>
          {l.photos.slice(1, 7).map((src, k) => <img key={src + k} src={src} alt="" loading="eager" style={{ width: "100%", height: "30mm", objectFit: "cover", display: "block" }} />)}
        </div>
      )}

      <div className="avoid" style={{ marginTop: 14, display: "grid", gridTemplateColumns: "1fr 1fr", columnGap: 18 }}>
        {facts.map(([k, v]) => (
          <div key={k} style={{ borderBottom: `1px solid ${BORDER_L}`, padding: "5px 0", display: "flex", justifyContent: "space-between", gap: 10, fontSize: 10.5 }}>
            <span style={{ color: MUTED_L, textTransform: "uppercase", letterSpacing: "0.14em", fontSize: 8.5 }}>{k}</span><span style={{ textAlign: "right" }}>{v}</span>
          </div>
        ))}
      </div>

      {l.amenities.length > 0 && (
        <div className="avoid" style={{ marginTop: 14 }}>
          <div style={{ fontSize: 8.5, letterSpacing: "0.3em", textTransform: "uppercase", color: GOLD, marginBottom: 6 }}>Amenities</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
            {l.amenities.map(a => <span key={a} style={{ border: `1px solid ${BORDER_L}`, background: CREAM, padding: "2px 7px", fontSize: 9.5 }}>{a}</span>)}
          </div>
        </div>
      )}

      {l.description.trim() && (
        <div className="avoid" style={{ marginTop: 14 }}>
          <div style={{ fontSize: 8.5, letterSpacing: "0.3em", textTransform: "uppercase", color: GOLD, marginBottom: 6 }}>Description</div>
          <p style={{ fontSize: 10.5, lineHeight: 1.6, margin: 0, whiteSpace: "pre-line" }}>{l.description.trim()}</p>
        </div>
      )}

      <div style={{ marginTop: 16, paddingTop: 8, borderTop: `1px solid ${BORDER_L}`, fontSize: 8, color: MUTED_L, display: "flex", justifyContent: "space-between" }}>
        <span>Printed from the Nepal Bhoomi admin on {longDate(new Date().toISOString())}</span>
        <span>Contains the owner&apos;s private details: for the team only.</span>
      </div>
    </div>,
    document.body,
  );
}

/** Prints the listing's PDF layout; the file is named after the listing. Waits for its photos first. */
async function downloadPdf(l: ListingSubmission): Promise<void> {
  const imgs = Array.from(document.querySelectorAll<HTMLImageElement>("#nb-print-doc img"));
  await Promise.all(imgs.map(img => (img.complete ? null : new Promise(r => { img.onload = img.onerror = r; }))));
  const title = document.title;
  document.title = `Nepal Bhoomi - free listing ${l.id} - ${l.title}`.replace(/[\\/:*?"<>|]+/g, " ");
  const restore = () => { document.title = title; window.removeEventListener("afterprint", restore); };
  window.addEventListener("afterprint", restore);
  window.print();
}

// ─── The page ──────────────────────────────────────────────────────────────────

/**
 * Admin → Free Listings → one listing, as its own page (/admin/listings/<id>), laid out like the
 * website's property page: photos, every detail the seller gave, the location (exact, admins only),
 * the owner's private contact, and what to do with it. Download PDF prints an A4 summary.
 */
export function AdminListingPage({ id, nav }: { id: number; nav: AdminNav }) {
  useDataVersion();
  const [toast, notify] = useToast();
  useEffect(() => onListingSaveFailed(message => notify(message)), [notify]);
  const act = useListingActions(notify, nav);
  useEffect(() => { window.scrollTo(0, 0); }, [id]);
  const l = LISTINGS.find(x => x.id === id);
  const back = { label: "Back to Free Listings", to: "admin-listings" as const };

  if (!l) {
    return (
      <AdminLayout nav={nav} current="admin-listings" tag="Free Listing" title={listingsLoaded ? "Listing not found" : "Loading…"} back={back}
        intro={listingsLoaded ? "It may have been removed. Go back to Free Listings to see the current list." : "Fetching the listing…"}>
        {toast}
      </AdminLayout>
    );
  }

  const p = listingToProp(l);
  const d = l.details;
  const facts = factsOf(l);
  const gaps = listingGaps(l);
  const point = d?.mapUrl ? exactFor({ mapUrl: d.mapUrl }) : null;
  const btn = "inline-flex items-center justify-center gap-2 h-11 px-5 border text-[10.5px] tracking-[0.2em] uppercase whitespace-nowrap transition-colors";
  const quiet = { borderColor: BORDER_L, background: WHITE, color: FG_LIGHT, ...sans };

  return (
    <AdminLayout nav={nav} current="admin-listings" tag={`Free Listing #${l.id}`} title={l.title || "Untitled"} back={back}
      intro={<>{l.type} · {l.listing} · {placeLabel(d?.address ?? "", l.district)} · sent {timeAgo(l.receivedAt)}</>}>
      <style>{PRINT_CSS}</style>
      <PrintDocument l={l} />

      {/* What to do with it */}
      <div className="flex flex-wrap items-center gap-2 mb-8">
        <StatusPill s={l.status} />
        {propertyRemoved(l) && <span className="text-[12px]" style={{ color: MUTED_L, ...sans }}>Its property was deleted from the website.</span>}
        <span className="flex-1" />
        <button type="button" onClick={() => void downloadPdf(l)} className={`${btn} hover:border-[#8a2030]`} style={quiet}><Download size={14} />Download PDF</button>
        {isOnSite(l) ? (
          <button type="button" onClick={() => nav.openProperty(l.propertyId)} className={`${btn} hover:brightness-110`} style={{ background: MAROON, borderColor: MAROON, color: WHITE, ...sans }}><Eye size={14} />View on Website</button>
        ) : l.status === "rejected" ? <>
          <button type="button" onClick={() => act.restore(l)} className={`${btn} hover:border-[#8a2030]`} style={quiet}><Undo2 size={14} />Restore</button>
          <button type="button" onClick={() => act.copyToProperty(l)} className={`${btn} hover:brightness-110`} style={{ background: MAROON, borderColor: MAROON, color: WHITE, ...sans }}><CopyPlus size={14} />Copy to Add Property</button>
        </> : <>
          {l.status === "new" && <button type="button" onClick={() => act.later(l)} className={`${btn} hover:border-[#8a2030]`} style={quiet}><Clock size={14} />Save for Later</button>}
          <button type="button" onClick={() => act.askReject(l)} className={`${btn} hover:border-[#8a2030] hover:text-[#8a2030]`} style={{ ...quiet, color: MUTED_L }}><X size={14} />Reject</button>
          <button type="button" onClick={() => act.copyToProperty(l)} className={`${btn} hover:brightness-110`} style={{ background: MAROON, borderColor: MAROON, color: WHITE, ...sans }}
            title="Opens the Add Property editor filled in with everything below"><CopyPlus size={14} />Copy to Add Property</button>
        </>}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10 items-start">
        <div className="lg:col-span-2 flex flex-col gap-10 min-w-0">
          <Gallery photos={l.photos} title={l.title} />

          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <p className="text-[28px]" style={{ color: MAROON, ...serif }}>{p.price || "Negotiable"}</p>
            {l.price.trim() && l.price.trim() !== p.price && <p className="text-[13px]" style={{ color: MUTED_L, ...sans }}>As typed: “{l.price.trim()}”</p>}
          </div>

          <div>
            <Heading>Property Details</Heading>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-10 border-t" style={{ borderColor: BORDER_L }}>
              {facts.map(([k, v]) => (
                <div key={k} className="flex items-baseline justify-between gap-4 py-3 border-b" style={{ borderColor: BORDER_L }}>
                  <dt className="text-[10px] tracking-[0.24em] uppercase shrink-0" style={{ color: MUTED_L, ...sans }}>{k}</dt>
                  <dd className="text-[15px] text-right" style={{ color: FG_LIGHT, ...sans }}>{v}</dd>
                </div>
              ))}
            </dl>
          </div>

          {l.amenities.length > 0 && (
            <div>
              <Heading>{l.type === "Land" ? "Land Features" : "Amenities"}</Heading>
              <div className="flex flex-wrap gap-2">
                {l.amenities.map(a => {
                  const Icon = amenityIcon(a);
                  return <span key={a} className="inline-flex items-center gap-2 px-3.5 py-2.5 border text-[13px]" style={{ borderColor: BORDER_L, color: FG_LIGHT, background: WHITE, ...sans }}>{Icon && <Icon size={16} />}{a}</span>;
                })}
              </div>
            </div>
          )}

          {l.description.trim() && (
            <div>
              <Heading>Description</Heading>
              <p className="text-[16px] leading-relaxed whitespace-pre-line" style={{ color: FG_LIGHT, ...sans }}>{l.description.trim()}</p>
            </div>
          )}

          <div>
            <Heading>Location</Heading>
            {point ? (
              <div className="relative border overflow-hidden" style={{ borderColor: BORDER_L, background: "#e9e3d8", aspectRatio: "16/8", minHeight: 260, width: "100%" }}>
                <AreaMap area={{ centre: point, shapeSeed: l.id, precise: true }}
                  card={{ title: l.title, price: p.price || "Negotiable", image: l.photos[0] ?? "", location: placeLabel(d?.address ?? "", l.district), listing: l.listing, facts: [] }}
                  fallback={<p className="absolute inset-0 flex items-center justify-center text-[13px]" style={{ color: MUTED_L, ...sans }}>The map could not be loaded.</p>} />
              </div>
            ) : (
              <p className="text-[14px]" style={{ color: MUTED_L, ...sans }}>
                {d?.mapUrl ? "The seller's map link has no pin we can read (a short link): open it to see the place." : "The seller didn't add a map link."}
              </p>
            )}
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <span className="flex items-center gap-2 text-[14px]" style={{ color: MUTED_L, ...sans }}><MapPin size={14} style={{ color: GOLD }} />{placeLabel(d?.address ?? "", l.district)}</span>
              {d?.mapUrl && <a href={d.mapUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-4 py-2.5 border text-[11px] tracking-[0.2em] uppercase transition-colors hover:border-[#8a2030] hover:text-[#8a2030]" style={{ borderColor: BORDER_L, color: FG_LIGHT, ...sans }}><ExternalLink size={13} />Open the Seller&apos;s Map Link</a>}
            </div>
            <p className="mt-2 text-[12px]" style={{ color: MUTED_L, ...sans }}>The exact spot is for the team only; the website shows visitors an approximate area unless you choose otherwise in the editor.</p>
          </div>
        </div>

        {/* The owner (private) and what's still missing */}
        <aside className="lg:sticky lg:top-[9.5rem] flex flex-col gap-5">
          <div className="border p-6" style={{ borderColor: "rgba(176,136,72,0.55)", background: "rgba(176,136,72,0.07)" }}>
            <p className="flex items-center gap-2 text-[10px] tracking-[0.26em] uppercase mb-3" style={{ color: GOLD, ...sans }}><Lock size={12} />Owner · private</p>
            <p className="text-[20px]" style={{ color: FG_LIGHT, ...serif }}>{l.seller.name}</p>
            <div className="mt-4 flex flex-col gap-2">
              <a href={`tel:${l.seller.phone.replace(/[^\d+]/g, "")}`} className={`${btn} hover:border-[#8a2030]`} style={quiet}><Phone size={14} />{l.seller.phone}</a>
              <a href={`https://wa.me/${digits(l.seller.phone)}`} target="_blank" rel="noopener noreferrer" className={`${btn} hover:brightness-110`} style={{ background: "#1f9e4d", borderColor: "#1f9e4d", color: WHITE, ...sans }}><MessageCircle size={14} />WhatsApp</a>
              {l.seller.email && <a href={`mailto:${l.seller.email}?subject=${encodeURIComponent(`Your free listing: ${l.title}`)}`} className={`${btn} hover:border-[#8a2030] normal-case tracking-normal text-[13px]`} style={quiet}><Mail size={14} />{l.seller.email}</a>}
            </div>
            {l.account && <p className="mt-4 text-[12px] leading-snug" style={{ color: MUTED_L, ...sans }}>Sent from the account {l.account.name ? `${l.account.name} (${l.account.email})` : l.account.email}.</p>}
            <p className="mt-1 text-[12px]" style={{ color: MUTED_L, ...sans }}>Received {longDate(l.receivedAt)}.</p>
          </div>

          {!isOnSite(l) && (gaps.required.length > 0 || gaps.recommended.length > 0) && (
            <div className="border p-6" style={{ borderColor: BORDER_L, background: WHITE }}>
              <p className="text-[10px] tracking-[0.26em] uppercase mb-3" style={{ color: MUTED_L, ...sans }}>To add in the editor</p>
              <div className="flex flex-wrap gap-1.5">
                {gaps.required.map(g => <span key={g} className="px-2 py-0.5 text-[12px]" style={{ background: "rgba(138,32,48,0.1)", color: MAROON, ...sans }}>{g}</span>)}
                {gaps.recommended.map(g => <span key={g} className="px-2 py-0.5 text-[12px]" style={{ background: "rgba(176,136,72,0.12)", color: "#7a5a24", ...sans }}>{g} (optional)</span>)}
              </div>
            </div>
          )}
          <div className="border p-5 text-[13px] leading-relaxed" style={{ borderColor: BORDER_L, background: BG_LIGHT, color: MUTED_L, ...sans }}>
            Nothing here is on the website. <b style={{ color: FG_LIGHT }}>Copy to Add Property</b> opens the property editor filled in with these details; you check them and publish from there.
          </div>
        </aside>
      </div>

      {act.ui}
      {toast}
    </AdminLayout>
  );
}
