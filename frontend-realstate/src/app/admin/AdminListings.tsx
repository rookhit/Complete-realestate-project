import { useEffect, useMemo, useState } from "react";
import { Camera, Clock, Eye, LayoutGrid, Lock, Pencil, Rows3, Send, Undo2, X } from "lucide-react";
import {
  LISTINGS, LISTING_STATUS, listingGaps, listingToProp, newListingsCount, onListingSaveFailed, updateListing,
  type ListingStatus, type ListingSubmission,
} from "@/app/data/listings";
import { timeAgo } from "@/app/data/messages";
import { applySaved, displayRef, type Prop } from "@/app/data/properties";
import { createProperty, propToInput } from "@/api/properties";
import { ApiError } from "@/app/auth";
import { useDataVersion } from "@/app/data/store";
import { BORDER_L, FG_LIGHT, GOLD, MAROON, MUTED_L, WHITE, sans, serif } from "@/app/components/ui/brand";
import { ListingCard } from "@/app/components/ui/property-cards";
import { ConfirmDialog } from "@/app/components/ui/confirm-dialog";
import { AdminLayout, type AdminNav } from "./AdminLayout";
import { PropertyEditor } from "./PropertyEditor";
import { ListingViewer } from "./ListingViewer";
import { EmptyState, SearchBox, useToast } from "./parts";

type Filter = "open" | ListingStatus | "all";
const STATUS_TONE: Record<ListingStatus, { bg: string; fg: string }> = {
  new: { bg: "#d93636", fg: WHITE }, draft: { bg: "rgba(176,136,72,0.16)", fg: "#7a5a24" },
  published: { bg: "rgba(31,158,77,0.12)", fg: "#1f7a43" }, rejected: { bg: "rgba(26,22,17,0.07)", fg: MUTED_L },
};

function StatusPill({ s }: { s: ListingStatus }) {
  const t = STATUS_TONE[s];
  return <span className="inline-block px-2.5 py-1 text-[10px] tracking-[0.16em] uppercase whitespace-nowrap" style={{ background: t.bg, color: t.fg, ...sans }}>{LISTING_STATUS[s]}</span>;
}
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
 * Admin → Free Listings: properties sellers submitted from the website. Review each one in
 * the property editor (the seller's details stay private), fill what is missing, then publish
 * now or save it for later. Two views: a spreadsheet-style table and the website's own cards.
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
  const [editing, setEditing] = useState<ListingSubmission | null>(null);
  const [toReject, setToReject] = useState<ListingSubmission | null>(null);
  // The listing open in the viewer (photos first, then details and actions). By id, so it
  // always shows the latest status after Save for Later / Reject.
  const [viewingId, setViewingId] = useState<number | null>(null);
  const viewing = LISTINGS.find(l => l.id === viewingId) ?? null;
  // Stable while the editor is open: a new object would restart the editor on every render.
  const source = useMemo(() => editing && {
    submission: editing,
    onSaveForLater: (p: Prop) => updateListing(editing.id, { status: "draft", draft: p }),
    onPublished: (p: Prop) => updateListing(editing.id, { status: "published", draft: p, propertyId: p.id }),
    onReject: () => { setEditing(null); setToReject(editing); },
  }, [editing]);

  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return LISTINGS.filter(l =>
      (filter === "all" || (filter === "open" ? l.status === "new" || l.status === "draft" : l.status === filter)) &&
      (!s || [l.title, l.district, l.type, l.seller.name, l.seller.phone, l.seller.email ?? ""].some(v => v.toLowerCase().includes(s))));
  }, [filter, q, LISTINGS.length, LISTINGS.map(l => l.status).join()]);

  const count = (f: Filter) => LISTINGS.filter(l => f === "all" || (f === "open" ? l.status === "new" || l.status === "draft" : l.status === f)).length;
  const filters: { key: Filter; label: string }[] = [
    { key: "open", label: "To review" }, { key: "new", label: "New" }, { key: "draft", label: "Saved for later" },
    { key: "published", label: "Published" }, { key: "rejected", label: "Rejected" }, { key: "all", label: "All" },
  ];

  /** Publish straight from the list when nothing is missing; otherwise open the editor. */
  const publish = (l: ListingSubmission) => {
    if (listingGaps(l).required.length) { setEditing(l); return; }
    // Saved to the API first; the server assigns the property id (the NB ID is the lowest free one).
    createProperty(propToInput(listingToProp(l))).then(res => {
      const p = applySaved(res.data);
      updateListing(l.id, { status: "published", propertyId: p.id, draft: p });
      notify(`“${p.title}” is now live as ${displayRef(p.nbId)}`, { label: "View", run: () => nav.openProperty(p.id) });
    }, err => notify(err instanceof ApiError ? err.message : "Could not publish. Please try again."));
  };
  /** Keep it aside to deal with later, without editing. */
  const later = (l: ListingSubmission) => {
    const before = l.status;
    updateListing(l.id, { status: "draft" });
    notify(`“${l.title}” saved for later`, { label: "Undo", run: () => updateListing(l.id, { status: before }) });
  };
  const restore = (l: ListingSubmission) => { updateListing(l.id, { status: l.statusBeforeReject ?? (l.draft ? "draft" : "new") }); notify(`“${l.title}” restored`); };
  const review = (l: ListingSubmission) => { setViewingId(null); setEditing(l); };
  const reject = (l: ListingSubmission) => {
    const before = l.status;
    updateListing(l.id, { status: "rejected", statusBeforeReject: before });
    setToReject(null);
    notify(`“${l.title}” rejected`, { label: "Undo", run: () => updateListing(l.id, { status: before }) });
  };

  /** Every action has a word on it: View (photos and details), Review, Later, Reject. */
  const actions = (l: ListingSubmission, compact = false) => {
    const btn = `inline-flex items-center gap-1.5 ${compact ? "h-8 px-2.5 text-[10px] tracking-[0.12em]" : "h-9 px-3 text-[10.5px] tracking-[0.16em]"} border uppercase whitespace-nowrap transition-colors hover:border-[#8a2030]`;
    const quiet = { borderColor: BORDER_L, background: WHITE, color: FG_LIGHT, ...sans };
    return (
      <div className={`flex ${compact ? "justify-end" : "flex-wrap"} gap-1.5`}>
        <button type="button" onClick={() => setViewingId(l.id)} className={btn} style={quiet} title="Photos and details"><Eye size={13} />View</button>
        {l.status === "published" ? (
          <button type="button" onClick={() => l.propertyId && nav.openProperty(l.propertyId)} className={btn} style={quiet}><Send size={13} />On Site</button>
        ) : l.status === "rejected" ? (
          <button type="button" onClick={() => restore(l)} className={btn} style={quiet}><Undo2 size={13} />Restore</button>
        ) : <>
          <button type="button" onClick={() => review(l)} className={btn} style={{ borderColor: MAROON, background: MAROON, color: WHITE, ...sans }}><Pencil size={13} />Review</button>
          {!compact && !listingGaps(l).required.length && <button type="button" onClick={() => publish(l)} className={btn} style={quiet}><Send size={13} />Publish</button>}
          {l.status === "new" && <button type="button" onClick={() => later(l)} className={btn} style={quiet} title="Keep it for later without editing"><Clock size={13} />Later</button>}
          <button type="button" onClick={() => setToReject(l)} className={btn} style={{ ...quiet, color: MUTED_L }}><X size={13} />Reject</button>
        </>}
      </div>
    );
  };

  return (
    <AdminLayout nav={nav} current="admin-listings" tag="Administration" title="Free Listings"
      intro={<>Sellers’ submissions: review, fill the gaps and publish. <span className="inline-flex items-center gap-1" style={{ color: FG_LIGHT }}><Lock size={13} />Seller details stay private.</span></>}>
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
              {list.map((l, i) => {
                const p = listingToProp(l);
                return (
                  <tr key={l.id} className="align-middle transition-colors hover:bg-[#faf7f2]" style={{ background: i % 2 ? "rgba(26,22,17,0.015)" : undefined }}>
                    <td className="px-3 py-3 border-b" style={{ borderColor: BORDER_L }}>
                      <StatusPill s={l.status} />
                      <span className="block mt-1.5 text-[11px] whitespace-nowrap" style={{ color: MUTED_L, ...sans }}>{timeAgo(l.receivedAt)}</span>
                    </td>
                    <td className="px-3 py-3 border-b" style={{ borderColor: BORDER_L }}>
                      <button type="button" onClick={() => setViewingId(l.id)} className="flex items-center gap-3 text-left group" title="View photos and details">
                        <span className="relative w-16 h-12 shrink-0 overflow-hidden" style={{ background: "#e9e3d8" }}>
                          {p.hero && <img src={p.hero} alt="" className="w-full h-full object-cover transition-transform group-hover:scale-105" />}
                          <span className="absolute right-0.5 bottom-0.5 inline-flex items-center gap-0.5 px-1 text-[10px] tabular-nums" style={{ background: "rgba(0,0,0,0.6)", color: WHITE, ...sans }}><Camera size={10} />{l.photos.length}</span>
                        </span>
                        <span className="min-w-0">
                          <span className="block text-[14px] leading-tight min-w-[150px] group-hover:text-[#8a2030]" style={{ color: FG_LIGHT, ...serif }}>{l.title}</span>
                          <span className="block text-[11px] mt-0.5" style={{ color: MUTED_L, ...sans }}>{l.type} · {l.listing === "For Rent" ? "Rent" : "Sale"} · <span style={{ color: l.photos.length ? MUTED_L : MAROON }}>{l.photos.length} photo{l.photos.length === 1 ? "" : "s"}</span></span>
                        </span>
                      </button>
                    </td>
                    <td className="px-3 py-3 border-b min-w-[170px] max-w-[220px]" style={{ borderColor: BORDER_L }}>{l.status === "published" ? <span className="text-[12px]" style={{ color: MUTED_L, ...sans }}>—</span> : <Gaps gaps={listingGaps(l)} />}</td>
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
          {list.map(l => {
            const p = listingToProp(l);
            return (
              <div key={l.id} className="flex flex-col border" style={{ borderColor: BORDER_L, background: WHITE }}>
                <div className="flex items-center justify-between gap-2 px-4 py-3 border-b" style={{ borderColor: BORDER_L }}>
                  <StatusPill s={l.status} />
                  <span className="text-[11px]" style={{ color: MUTED_L, ...sans }}>{timeAgo(l.receivedAt)}</span>
                </div>
                {/* Exactly the card visitors will see once it is published. */}
                <div className="relative">
                  <ListingCard p={{ ...p, title: p.title || "Untitled", price: p.price || "Price not set" }} light showDetails onOpen={() => setViewingId(l.id)} />
                  <button type="button" onClick={() => setViewingId(l.id)} className="absolute right-3 top-3 z-10 inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] tracking-[0.1em] transition-colors hover:bg-black/80"
                    style={{ background: "rgba(0,0,0,0.6)", color: WHITE, ...sans }}><Camera size={13} />{l.photos.length} photo{l.photos.length === 1 ? "" : "s"}</button>
                </div>
                <div className="mt-auto px-5 pb-5 flex flex-col gap-3 border-t pt-4" style={{ borderColor: BORDER_L }}>
                  <p className="flex items-center gap-2 text-[12px]" style={{ color: MUTED_L, ...sans }}>
                    <Lock size={12} style={{ color: GOLD }} />{l.seller.name} · {l.seller.phone}
                  </p>
                  {l.status !== "published" && <div className="flex items-start gap-2"><span className="text-[10px] tracking-[0.2em] uppercase pt-1" style={{ color: MUTED_L, ...sans }}>To add</span><Gaps gaps={listingGaps(l)} /></div>}
                  {actions(l)}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <PropertyEditor property={null} open={editing !== null} onClose={() => setEditing(null)} onSaved={notify} onViewOnSite={nav.openProperty}
        source={source} />
      <ConfirmDialog open={!!toReject} title="Reject this listing?"
        message={toReject ? `“${toReject.title}” from ${toReject.seller.name} won’t be published. You can restore it from the Rejected filter.` : ""}
        confirmLabel="Reject" onCancel={() => setToReject(null)} onConfirm={() => toReject && reject(toReject)} />
      <ListingViewer listing={viewing} onClose={() => setViewingId(null)} onReview={review}
        onPublish={l => { publish(l); setViewingId(null); }} onLater={later} onReject={l => setToReject(l)} onRestore={restore}
        onViewLive={l => l.propertyId && nav.openProperty(l.propertyId)} />
      {toast}
    </AdminLayout>
  );
}
