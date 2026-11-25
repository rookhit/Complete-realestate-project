import { useEffect, useMemo, useState, type ReactNode } from "react";
import { CalendarCheck, Handshake, KeyRound, MapPin, Pencil, Plus, RotateCcw, Search, Trash2, X } from "lucide-react";
import { ApiError } from "@/app/auth";
import { closePropertyOnServer, deletePropertyOnServer, reopenPropertyOnServer, restorePropertyOnServer, toProp } from "@/api/properties";
import { ALL_PROPS, CLOSED_PROPS, applySaved, deleteProperty, displayRef, matchesRefNumber, restoreProperty, type Listing, type Prop } from "@/app/data/properties";
import { REACTIONS } from "@/app/data/reviews";
import { useDataVersion } from "@/app/data/store";
import { BG_LIGHT, BORDER_L, FG_LIGHT, GOLD, MAROON, MUTED_L, WHITE, sans, serif } from "@/app/components/ui/brand";
import { Button } from "@/app/components/ui/form-controls";
import { ListPagination, paginate, usePageTurner } from "@/app/components/ui/list-pagination";
import { ConfirmDialog } from "@/app/components/ui/confirm-dialog";
import { coverStyle, frameOf } from "@/app/components/ui/cover-frame";
import { cardSrc, fullPhotoOnError } from "@/app/components/ui/card-photo";
import { Chip, EmptyState, SearchBox, SectionHeading, type Notify } from "./parts";

// Sold and rented-out properties, two separate lists (Admin → Sold, Admin → Rented Out).
// "Mark as Sold" / "Mark as Rented" takes a property off the website without losing it: the server
// sets its closedAt (POST /admin/properties/:id/close), the website never receives it again, and it
// is kept here with its NB ID, photos, details, reviews and hearts until it is put back (…/reopen)
// or deleted.

/** How each list is worded: a sale is "Sold", a rental "Rented out". */
const WORDS: Record<Listing, { done: string; mark: string; title: string; Icon: typeof Handshake }> = {
  "For Sale": { done: "Sold", mark: "Mark as Sold", title: "Sold Properties", Icon: Handshake },
  "For Rent": { done: "Rented out", mark: "Mark as Rented", title: "Rented Out", Icon: KeyRound },
};
/** "Sold" for a sale, "Rented out" for a rental. */
export const dealLabel = (p: Pick<Prop, "listing">) => WORDS[p.listing].done;
/** The button that closes it: "Mark as Sold" / "Mark as Rented". */
export const closeLabel = (p: Pick<Prop, "listing">) => WORDS[p.listing].mark;
const closedOn = (iso?: string) => (iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "");

/**
 * Taking a property off the website as sold / rented out, and putting it back. Shared by Properties
 * (mark) and the Sold / Rented Out lists (mark, put back); each comes with an Undo.
 * Render `ui` once (the confirmation).
 */
export function useDealActions(notify: Notify): { askClose: (p: Prop) => void; reopen: (p: Prop) => void; ui: ReactNode } {
  const [toClose, setToClose] = useState<Prop | null>(null);
  const failed = (err: unknown) => notify(err instanceof ApiError ? err.message : "Could not save. Please try again.");

  const close = (p: Prop, undoing = false) => {
    // Same rule as deleting: the website must keep at least one property.
    if (ALL_PROPS.length <= 1) { notify("The website needs at least one property on it"); return; }
    closePropertyOnServer(p.id).then(res => {
      applySaved(res.data);
      if (!undoing) notify(`“${p.title}” marked as ${dealLabel(p).toLowerCase()}: off the website, kept in ${WORDS[p.listing].title}`, { label: "Undo", run: () => reopen(p, true) });
    }, failed);
  };
  const reopen = (p: Prop, undoing = false) => {
    reopenPropertyOnServer(p.id).then(res => {
      applySaved(res.data);
      if (!undoing) notify(`“${p.title}” is back on the website`, { label: "Undo", run: () => close(p, true) });
    }, failed);
  };

  const ui = (
    <ConfirmDialog open={toClose !== null} title={toClose ? `${closeLabel(toClose)}?` : ""} confirmLabel={toClose ? closeLabel(toClose) : ""}
      message={toClose ? `“${toClose.title}” (${displayRef(toClose.nbId)}) will be taken off the website and kept in ${WORDS[toClose.listing].title} with its photos and details. You can put it back on the website any time.` : ""}
      onCancel={() => setToClose(null)}
      onConfirm={() => { if (toClose) close(toClose); setToClose(null); }} />
  );
  return { askClose: setToClose, reopen: p => reopen(p), ui };
}

/** Pick a property on the website (of one listing) to mark as sold / rented: search, click. */
function PickProperty({ listing, open, onPick, onClose }: { listing: Listing; open: boolean; onPick: (p: Prop) => void; onClose: () => void }) {
  const [q, setQ] = useState("");
  useEffect(() => { if (open) setQ(""); }, [open]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  const s = q.trim().toLowerCase();
  const list = ALL_PROPS.filter(p => p.listing === listing &&
    (!s || [p.title, p.location, p.district, p.type].some(v => v.toLowerCase().includes(s)) || matchesRefNumber(p.nbId, s)));
  return (
    <div className="fixed inset-0 z-[80] flex items-start sm:items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={`${WORDS[listing].mark}: choose a property`}>
      <div className="absolute inset-0" style={{ background: "rgba(10,9,8,0.55)" }} onClick={onClose} />
      <div className="relative w-full max-w-xl max-h-[85svh] flex flex-col border shadow-2xl" style={{ background: WHITE, borderColor: BORDER_L }}>
        <div className="flex items-start justify-between gap-4 px-6 pt-6 pb-4">
          <div>
            <p className="text-[22px] leading-tight" style={{ color: FG_LIGHT, ...serif }}>{WORDS[listing].mark}</p>
            <p className="mt-1 text-[13px]" style={{ color: MUTED_L, ...sans }}>Choose the {listing === "For Rent" ? "rental" : "property"} from the website. It moves to {WORDS[listing].title}.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="p-1.5 transition-colors hover:text-[#8a2030]" style={{ color: MUTED_L }}><X size={18} /></button>
        </div>
        <div className="px-6 pb-4">
          <div className="relative">
            <Search size={15} className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: MUTED_L }} />
            <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="Search by name, area or ref (#NBS004)" aria-label="Search properties" maxLength={100}
              className="w-full border pl-11 pr-4 py-3 text-[14px] outline-none focus:border-[#8a2030]" style={{ borderColor: BORDER_L, color: FG_LIGHT, ...sans }} />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto border-t" style={{ borderColor: BORDER_L, background: BG_LIGHT }}>
          {list.length === 0 ? (
            <p className="px-6 py-10 text-center text-[14px]" style={{ color: MUTED_L, ...sans }}>
              {ALL_PROPS.some(p => p.listing === listing) ? "Nothing matches that search." : `No ${listing === "For Rent" ? "rentals" : "sale properties"} on the website.`}
            </p>
          ) : list.map(p => (
            <button key={p.id} type="button" onClick={() => onPick(p)}
              className="w-full flex items-center gap-4 px-6 py-3 text-left border-b transition-colors hover:bg-white" style={{ borderColor: BORDER_L }}>
              <span className="w-16 h-12 shrink-0 overflow-hidden" style={{ background: "#e9e3d8" }}>
                {p.hero && <img src={cardSrc(p.hero)} onError={fullPhotoOnError(p.hero)} alt="" className="w-full h-full object-cover" style={coverStyle(frameOf(p))} />}
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-[15px] truncate" style={{ color: FG_LIGHT, ...serif }}>{p.title}</span>
                <span className="block text-[12px] truncate" style={{ color: MUTED_L, ...sans }}>{displayRef(p.nbId)} · {p.location} · {p.price}</span>
              </span>
              <span className="shrink-0 text-[10px] tracking-[0.2em] uppercase" style={{ color: MAROON, ...sans }}>Choose</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

const PER_PAGE = 6;

/** Admin → Sold (listing "For Sale") or Admin → Rented Out ("For Rent"): taken off the website after the deal. */
export function SoldRentedSection({ listing, notify, onEdit }: { listing: Listing; notify: Notify; onEdit: (p: Prop) => void }) {
  const version = useDataVersion();
  const w = WORDS[listing];
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const { listTop, turn } = usePageTurner(setPage);
  const [picking, setPicking] = useState(false);
  const [toDelete, setToDelete] = useState<Prop | null>(null);
  const deal = useDealActions(notify);
  // The other list switches the section: start it fresh.
  useEffect(() => { setQ(""); setPage(1); }, [listing]);

  const all = useMemo(() => CLOSED_PROPS.filter(p => p.listing === listing), [listing, version]);
  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    return all.filter(p => !s || [p.title, p.location, p.district, p.type].some(v => v.toLowerCase().includes(s)) || matchesRefNumber(p.nbId, s));
  }, [all, q]);
  const current = Math.min(page, Math.max(1, Math.ceil(rows.length / PER_PAGE)));

  // Delete for good (60 s Undo, like Properties): the website never shows it anyway.
  const remove = (p: Prop) => {
    const at = CLOSED_PROPS.findIndex(x => x.id === p.id);
    deletePropertyOnServer(p.id).then(() => {
      deleteProperty(p.id);
      notify(`“${p.title}” deleted. ${displayRef(p.nbId)} is free again`, { label: "Undo", run: () => {
        restorePropertyOnServer(p.id).then(res => {
          const back = restoreProperty(toProp(res.data), at);
          if (back) REACTIONS[back.id] = res.data.reactionCount;
          if (back && res.meta?.nbIdChanged) notify(`“${p.title}” is back as ${displayRef(back.nbId)} (${displayRef(p.nbId)} was taken meanwhile)`);
        }, err => notify(err instanceof ApiError ? err.message : "Could not restore it."));
      } });
    }, err => notify(err instanceof ApiError ? err.message : "Could not delete it. Please try again."));
  };

  return (
    <div>
      <SectionHeading title={w.title}
        subtitle={`${listing === "For Rent" ? "Rentals taken off the website once rented out" : "Properties taken off the website once sold"}. Everything is kept: photos, details, reviews and the NB ID. Put one back on the website any time.`}
        actions={<Button onClick={() => setPicking(true)}><Plus size={14} />{w.mark.replace("Mark as", "Mark a Property as")}</Button>} />

      <div className="flex mb-6"><SearchBox value={q} onChange={v => { setQ(v); setPage(1); }} placeholder="Search by name, area or ref (#NBS004)" /></div>

      <div ref={listTop} className="scroll-mt-28" aria-hidden="true" />
      {rows.length === 0 ? (
        <EmptyState title={all.length ? "Nothing matches" : `Nothing ${w.done.toLowerCase()} yet`}
          text={all.length ? "Try a different search."
            : `When a ${listing === "For Rent" ? "rental is rented out" : "property is sold"}, press “${w.mark.replace("Mark as", "Mark a Property as")}” above, or “${w.mark}” on it in Properties. It leaves the website and is kept here.`}
          action={all.length ? undefined : <Button onClick={() => setPicking(true)}><Plus size={14} />{w.mark.replace("Mark as", "Mark a Property as")}</Button>} />
      ) : (
        <div className="border" style={{ borderColor: BORDER_L, background: WHITE }}>
          {paginate(rows, current, PER_PAGE).map(p => (
            <div key={p.id} className="flex flex-col md:flex-row md:items-center gap-5 p-5 border-b last:border-b-0" style={{ borderColor: BORDER_L }}>
              <button onClick={() => onEdit(p)} className="relative w-full md:w-40 shrink-0 overflow-hidden" style={{ aspectRatio: "4/3" }} aria-label={`Edit ${p.title}`}>
                <img src={cardSrc(p.hero)} onError={fullPhotoOnError(p.hero)} alt="" className="w-full h-full object-cover grayscale-[35%]" style={coverStyle(frameOf(p))} />
                <span className="absolute left-2 top-2 px-2 py-0.5 text-[9px] tracking-[0.2em] uppercase" style={{ background: FG_LIGHT, color: WHITE, ...sans }}>{w.done}</span>
              </button>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap gap-1.5 mb-2"><Chip tone="muted">{p.type}</Chip>{p.badge && <Chip tone="muted">{p.badge}</Chip>}</div>
                <p className="text-[18px] leading-snug truncate" style={{ color: FG_LIGHT, ...serif }} title={p.title}>{p.title}</p>
                {/* Same one-line form as the Properties list: NB ID first, the address cut with … if long. */}
                <p className="flex items-center gap-1.5 mt-1 text-[13px] min-w-0" style={{ color: MUTED_L, ...sans }} title={p.location}>
                  <span className="shrink-0 tabular-nums" style={{ color: FG_LIGHT }}>{displayRef(p.nbId)}</span>
                  <span className="shrink-0">·</span>
                  <MapPin size={12} className="shrink-0" style={{ color: GOLD }} />
                  <span className="truncate">{p.location}</span>
                </p>
                <div className="flex flex-wrap items-center gap-x-5 gap-y-1 mt-3 text-[13px]" style={{ ...sans }}>
                  <span style={{ color: MAROON }} className="font-medium whitespace-nowrap">{p.price}</span>
                  <span className="inline-flex items-center gap-1.5" style={{ color: FG_LIGHT }}><CalendarCheck size={13} style={{ color: GOLD }} />{w.done} on {closedOn(p.closedAt)}</span>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 md:justify-end">
                <Button onClick={() => deal.reopen(p)} title="Show it on the website again"><RotateCcw size={13} />Put Back on Website</Button>
                <Button variant="quiet" onClick={() => onEdit(p)}><Pencil size={13} />Edit</Button>
                <button type="button" aria-label={`Delete ${p.title}`} title="Delete for good" onClick={() => setToDelete(p)}
                  className="w-[46px] h-[46px] flex items-center justify-center border transition-colors hover:border-[#8a2030] hover:text-[#8a2030]" style={{ borderColor: BORDER_L, color: MUTED_L }}><Trash2 size={15} /></button>
              </div>
            </div>
          ))}
        </div>
      )}
      <ListPagination page={current} total={rows.length} perPage={PER_PAGE} onPage={turn} noun={listing === "For Rent" ? "rentals" : "properties"} />

      <p className="mt-6 flex items-start gap-2 text-[12px] leading-relaxed" style={{ color: MUTED_L, ...sans }}>
        <w.Icon size={14} className="shrink-0 mt-0.5" style={{ color: GOLD }} />
        Visitors can’t open these, and they aren’t in search results or the sitemap. Their NB IDs stay taken, so a new listing never reuses one.
      </p>

      <PickProperty listing={listing} open={picking} onClose={() => setPicking(false)} onPick={p => { setPicking(false); deal.askClose(p); }} />
      {deal.ui}
      <ConfirmDialog open={toDelete !== null} title="Delete this property for good?"
        message={toDelete ? `“${toDelete.title}” (${displayRef(toDelete.nbId)}) and its photos will be deleted. You can undo this for a few seconds afterwards. To show it on the website again, use “Put Back on Website” instead.` : ""}
        onCancel={() => setToDelete(null)}
        onConfirm={() => { if (toDelete) remove(toDelete); setToDelete(null); }} />
    </div>
  );
}
