import { useEffect, useMemo, useState } from "react";
import { Camera, Clock, CopyPlus, Eye, LayoutGrid, Lock, Rows3, Send, Undo2, X } from "lucide-react";
import {
  LISTINGS, listingGaps, listingToProp, newListingsCount, onListingSaveFailed,
  type ListingStatus, type ListingSubmission,
} from "@/app/data/listings";
import { timeAgo } from "@/app/data/messages";
import { useDataVersion } from "@/app/data/store";
import { BORDER_L, FG_LIGHT, GOLD, MAROON, MUTED_L, WHITE, sans, serif } from "@/app/components/ui/brand";
import { ListingCard } from "@/app/components/ui/property-cards";
import { ListPagination, pageCount, paginate, usePageTurner } from "@/app/components/ui/list-pagination";
import { AdminLayout, type AdminNav } from "./AdminLayout";
import { StatusPill, isOnSite, useListingActions } from "./listing-actions";
import { EmptyState, SearchBox, useToast } from "./parts";

import { cardSrc, fullPhotoOnError } from "@/app/components/ui/card-photo";
type Filter = "open" | ListingStatus | "all";
const PER_PAGE = 20;
/** Red: needed before publishing. Gold: worth adding, but optional. */
function Gaps({ gaps }: { gaps: ReturnType<typeof listingGaps> }) {
  if (!gaps.required.length && !gaps.recommended.length) return <span className="text-[12px]" style={{ color: "#1f7a43", ...sans }}>Complete</span>;
  return (
    <span className="flex flex-wrap gap-1">
      {gaps.required.map(g => <span key={g} title="Needed before publishing" className="px-1.5 py-0.5 text-[11px] whitespace-nowrap" style={{ background: "rgba(138,32,48,0.1)", color: MAROON, ...sans }}>{g}</span>)}
      {gaps.recommended.map(g => <span key={g} title="Optional, but makes a better listing" className="px-1.5 py-0.5 text-[11px] whitespace-nowrap" style={{ background: "rgba(176,136,72,0.12)", color: "#7a5a24", ...sans }}>{g}</span>)}
    </span>
  );
}

/**
 * Admin → Free Listings: properties sellers submitted from the website. Open one as its own page
 * (photos, every detail, the seller's private contact, Download PDF), then "Copy to Add Property"
 * to publish it through the normal editor, save it for later, or reject it. Nothing is published
 * straight from here. Two views: a spreadsheet-style table and the website's own cards.
 */
export function AdminListings({ nav }: { nav: AdminNav }) {
  useDataVersion();
  const [toast, notify] = useToast();
  // A change that could not be saved (it has gone back) is reported here.
  useEffect(() => onListingSaveFailed(message => notify(message)), [notify]);
  // Phones start on cards: a wide table on a small screen is hard to read.
  const [view, setView] = useState<"table" | "cards">(() => (typeof window !== "undefined" && window.innerWidth < 768 ? "cards" : "table"));
  const [filter, setFilter] = useState<Filter>("open");
  const [q, setQ] = useState("");
  const act = useListingActions(notify, nav);
  const open = (l: ListingSubmission) => nav.openListing(l.id);

  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return LISTINGS.filter(l =>
      (filter === "all" || (filter === "open" ? l.status === "new" || l.status === "draft" : l.status === filter)) &&
      (!s || [l.title, l.district, l.type, l.seller.name, l.seller.phone, l.seller.email ?? ""].some(v => v.toLowerCase().includes(s))));
  }, [filter, q, LISTINGS.length, LISTINGS.map(l => l.status).join()]);

  // 20 a page in either view; a new filter or search starts again at page 1.
  const [pageNo, setPageNo] = useState(1);
  useEffect(() => { setPageNo(1); }, [filter, q]);
  const current = Math.min(pageNo, pageCount(list.length, PER_PAGE));
  const shown = paginate(list, current, PER_PAGE);
  const { listTop, turn } = usePageTurner(setPageNo);

  const count = (f: Filter) => LISTINGS.filter(l => f === "all" || (f === "open" ? l.status === "new" || l.status === "draft" : l.status === f)).length;
  const filters: { key: Filter; label: string }[] = [
    { key: "open", label: "To review" }, { key: "new", label: "New" }, { key: "draft", label: "Saved for later" },
    { key: "published", label: "Published" }, { key: "rejected", label: "Rejected" }, { key: "all", label: "All" },
  ];

  /** Every action has a word on it: Open (the listing's page), Copy to Add Property, Later, Reject. */
  const actions = (l: ListingSubmission, compact = false) => {
    const btn = `inline-flex items-center gap-1.5 ${compact ? "h-8 px-2.5 text-[10px] tracking-[0.12em]" : "h-9 px-3 text-[10.5px] tracking-[0.16em]"} border uppercase whitespace-nowrap transition-colors hover:border-[#8a2030]`;
    const quiet = { borderColor: BORDER_L, background: WHITE, color: FG_LIGHT, ...sans };
    return (
      <div className={`flex ${compact ? "justify-end" : "flex-wrap"} gap-1.5`}>
        <button type="button" onClick={() => open(l)} className={btn} style={quiet} title="Photos, every detail, the seller and Download PDF"><Eye size={13} />Open</button>
        {isOnSite(l) ? (
          <button type="button" onClick={() => nav.openProperty(l.propertyId)} className={btn} style={quiet}><Send size={13} />On Site</button>
        ) : l.status === "rejected" ? (
          <button type="button" onClick={() => act.restore(l)} className={btn} style={quiet}><Undo2 size={13} />Restore</button>
        ) : <>
          <button type="button" onClick={() => act.copyToProperty(l)} className={btn} style={{ borderColor: MAROON, background: MAROON, color: WHITE, ...sans }}
            title="Open the Add Property editor filled in with the seller's details"><CopyPlus size={13} />{compact ? "Copy" : "Copy to Add Property"}</button>
          {l.status === "new" && <button type="button" onClick={() => act.later(l)} className={btn} style={quiet} title="Keep it for later without editing"><Clock size={13} />Later</button>}
          <button type="button" onClick={() => act.askReject(l)} className={btn} style={{ ...quiet, color: MUTED_L }}><X size={13} />Reject</button>
        </>}
      </div>
    );
  };

  return (
    <AdminLayout nav={nav} current="admin-listings" tag="Administration" title="Free Listings"
      intro={<>Sellers’ submissions: open one to see everything, then copy it into Add Property to publish. <span className="inline-flex items-center gap-1" style={{ color: FG_LIGHT }}><Lock size={13} />Seller details stay private.</span></>}>
      <div className="flex flex-col lg:flex-row lg:items-center gap-4 mb-6">
        <div className="flex gap-2 overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0 sm:flex-wrap sm:overflow-visible [scrollbar-width:none] [&::-webkit-scrollbar]:hidden flex-1 min-w-0">
          {filters.map(f => {
            const on = filter === f.key, n = count(f.key);
            return (
              <button key={f.key} type="button" onClick={() => setFilter(f.key)} aria-pressed={on}
                className="shrink-0 inline-flex items-center gap-2 px-4 py-2 border text-[12px] tracking-[0.06em] transition-colors hover:border-[#8a2030]"
                style={{ borderColor: on ? FG_LIGHT : BORDER_L, background: on ? FG_LIGHT : WHITE, color: on ? WHITE : FG_LIGHT, ...sans }}>
                {f.label}
                <span className="min-w-5 h-5 px-1.5 rounded-full inline-flex items-center justify-center text-[10px] tabular-nums"
                  style={f.key === "new" && n > 0 ? { background: "#d93636", color: WHITE } : { background: on ? "rgba(255,255,255,0.18)" : "rgba(26,22,17,0.06)", color: on ? WHITE : MUTED_L }}>{n}</span>
              </button>
            );
          })}
        </div>
        <div className="flex border shrink-0" style={{ borderColor: BORDER_L }} role="group" aria-label="View">
          {([["table", "Table", Rows3], ["cards", "Cards", LayoutGrid]] as const).map(([k, label, Icon]) => (
            <button key={k} type="button" onClick={() => setView(k)} aria-pressed={view === k}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-[11px] tracking-[0.18em] uppercase transition-colors"
              style={{ background: view === k ? FG_LIGHT : WHITE, color: view === k ? WHITE : FG_LIGHT, ...sans }}><Icon size={14} />{label}</button>
          ))}
        </div>
      </div>
      <div className="mb-6 flex flex-col md:flex-row md:items-center gap-4">
        <div className="flex-1 max-w-xl"><SearchBox value={q} onChange={setQ} placeholder="Search by title, district, type or seller" /></div>
        <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px]" style={{ color: MUTED_L, ...sans }}>
          <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5" style={{ background: "rgba(138,32,48,0.35)" }} />Needed before publishing</span>
          <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5" style={{ background: "rgba(176,136,72,0.45)" }} />Optional, but worth adding</span>
        </p>
      </div>

      <div ref={listTop} className="scroll-mt-28" aria-hidden="true" />
      {list.length === 0 ? (
        <EmptyState title={LISTINGS.length ? "Nothing here" : "No free listings yet"} text={newListingsCount() ? "Try another filter." : "When a seller submits the Free Listing form, it appears here with a red count."} />
      ) : view === "table" ? (
        // relative: below md the Actions column isn't sticky, and its sr-only label (position:absolute)
        // would otherwise be placed against the page and widen it.
        <div className="relative border overflow-x-auto" style={{ borderColor: BORDER_L, background: WHITE }}>
          <table className="w-full min-w-[960px] text-left border-collapse">
            <thead>
              <tr style={{ background: "#faf7f2" }}>
                {["Status", "Property", "To add", "District", "Price asked", "Area", "Seller (private)"].map(h => (
                  <th key={h} className="px-3 py-3 border-b text-[10px] tracking-[0.2em] uppercase font-normal whitespace-nowrap" style={{ borderColor: BORDER_L, color: MUTED_L, ...sans }}>{h}</th>
                ))}
                <th className="md:sticky right-0 px-3 py-3 border-b border-l" style={{ borderColor: BORDER_L, background: "#faf7f2" }}><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {shown.map((l, i) => {
                const p = listingToProp(l);
                return (
                  <tr key={l.id} className="align-middle transition-colors hover:bg-[#faf7f2]" style={{ background: i % 2 ? "rgba(26,22,17,0.015)" : undefined }}>
                    <td className="px-3 py-3 border-b" style={{ borderColor: BORDER_L }}>
                      <StatusPill s={l.status} />
                      <span className="block mt-1.5 text-[11px] whitespace-nowrap" style={{ color: MUTED_L, ...sans }}>{timeAgo(l.receivedAt)}</span>
                    </td>
                    <td className="px-3 py-3 border-b" style={{ borderColor: BORDER_L }}>
                      <button type="button" onClick={() => open(l)} className="flex items-center gap-3 text-left group" title="Open the listing">
                        <span className="relative w-16 h-12 shrink-0 overflow-hidden" style={{ background: "#e9e3d8" }}>
                          {p.hero && <img src={cardSrc(p.hero)} onError={fullPhotoOnError(p.hero)} alt="" className="w-full h-full object-cover transition-transform group-hover:scale-105" />}
                          <span className="absolute right-0.5 bottom-0.5 inline-flex items-center gap-0.5 px-1 text-[10px] tabular-nums" style={{ background: "rgba(0,0,0,0.6)", color: WHITE, ...sans }}><Camera size={10} />{l.photos.length}</span>
                        </span>
                        <span className="min-w-0">
                          <span className="block text-[14px] leading-tight min-w-[150px] group-hover:text-[#8a2030]" style={{ color: FG_LIGHT, ...serif }}>{l.title}</span>
                          <span className="block text-[11px] mt-0.5" style={{ color: MUTED_L, ...sans }}>{l.type} · {l.listing === "For Rent" ? "Rent" : "Sale"} · <span style={{ color: l.photos.length ? MUTED_L : MAROON }}>{l.photos.length} photo{l.photos.length === 1 ? "" : "s"}</span></span>
                        </span>
                      </button>
                    </td>
                    <td className="px-3 py-3 border-b min-w-[170px] max-w-[220px]" style={{ borderColor: BORDER_L }}>{isOnSite(l) ? <span className="text-[12px]" style={{ color: MUTED_L, ...sans }}>—</span> : <Gaps gaps={listingGaps(l)} />}</td>
                    <td className="px-3 py-3 border-b text-[13px]" style={{ borderColor: BORDER_L, color: FG_LIGHT, ...sans }}>{l.district}</td>
                    <td className="px-3 py-3 border-b text-[13px] whitespace-nowrap tabular-nums" style={{ borderColor: BORDER_L, color: FG_LIGHT, ...sans }}>
                      {p.price || <span style={{ color: MAROON }}>—</span>}
                    </td>
                    <td className="px-3 py-3 border-b text-[12px] whitespace-nowrap" style={{ borderColor: BORDER_L, color: FG_LIGHT, ...sans }}>
                      {[p.builtArea !== "—" && p.builtArea, p.landArea !== "—" && p.landArea].filter(Boolean).join(" · ") || <span style={{ color: MAROON }}>—</span>}
                    </td>
                    <td className="px-3 py-3 border-b text-[12px]" style={{ borderColor: BORDER_L, ...sans }}>
                      <span className="block" style={{ color: FG_LIGHT }}>{l.seller.name}</span>
                      <span className="block" style={{ color: MUTED_L }}>{l.seller.phone}</span>
                    </td>
                    <td className="md:sticky right-0 px-3 py-3 border-b border-l" style={{ borderColor: BORDER_L, background: WHITE, boxShadow: "-8px 0 12px -10px rgba(26,22,17,0.25)" }}>{actions(l, true)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {shown.map(l => {
            const p = listingToProp(l);
            return (
              <div key={l.id} className="flex flex-col border" style={{ borderColor: BORDER_L, background: WHITE }}>
                <div className="flex items-center justify-between gap-2 px-4 py-3 border-b" style={{ borderColor: BORDER_L }}>
                  <StatusPill s={l.status} />
                  <span className="text-[11px]" style={{ color: MUTED_L, ...sans }}>{timeAgo(l.receivedAt)}</span>
                </div>
                {/* Exactly the card visitors will see once it is published. */}
                <div className="relative">
                  <ListingCard p={{ ...p, title: p.title || "Untitled", price: p.price || "Price not set" }} light showDetails onOpen={() => open(l)} />
                  <button type="button" onClick={() => open(l)} className="absolute right-3 top-3 z-10 inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] tracking-[0.1em] transition-colors hover:bg-black/80"
                    style={{ background: "rgba(0,0,0,0.6)", color: WHITE, ...sans }}><Camera size={13} />{l.photos.length} photo{l.photos.length === 1 ? "" : "s"}</button>
                </div>
                <div className="mt-auto px-5 pb-5 flex flex-col gap-3 border-t pt-4" style={{ borderColor: BORDER_L }}>
                  <p className="flex items-center gap-2 text-[12px]" style={{ color: MUTED_L, ...sans }}>
                    <Lock size={12} style={{ color: GOLD }} />{l.seller.name} · {l.seller.phone}
                  </p>
                  {!isOnSite(l) && <div className="flex items-start gap-2"><span className="text-[10px] tracking-[0.2em] uppercase pt-1" style={{ color: MUTED_L, ...sans }}>To add</span><Gaps gaps={listingGaps(l)} /></div>}
                  {actions(l)}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {list.length > PER_PAGE && <ListPagination page={current} total={list.length} perPage={PER_PAGE} onPage={turn} noun="listings" />}
      {act.ui}
      {toast}
    </AdminLayout>
  );
}
