import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ChevronLeft, ChevronRight, Clock, Eye, ImageOff, Lock, Pencil, Send, Undo2, X } from "lucide-react";
import { LISTING_STATUS, listingGaps, type ListingSubmission } from "@/app/data/listings";
import { timeAgo } from "@/app/data/messages";
import { BORDER_L, FG_LIGHT, GOLD, MAROON, MUTED_L, WHITE, sans, serif } from "@/app/components/ui/brand";

/**
 * A seller's free listing, opened from the list: the photos first (large, with arrows and
 * thumbnails), then everything they sent, their private details, what is missing, and
 * every action with a clear label: Review & Edit, Publish, Save for Later, Reject.
 */
export function ListingViewer({ listing, onClose, onReview, onPublish, onLater, onReject, onRestore, onViewLive }: {
  listing: ListingSubmission | null;
  onClose: () => void;
  onReview: (l: ListingSubmission) => void;
  onPublish: (l: ListingSubmission) => void;
  onLater: (l: ListingSubmission) => void;
  onReject: (l: ListingSubmission) => void;
  onRestore: (l: ListingSubmission) => void;
  onViewLive: (l: ListingSubmission) => void;
}) {
  const [i, setI] = useState(0);
  const photos = listing?.photos ?? [];
  const n = photos.length;

  useEffect(() => { setI(0); }, [listing?.id]);
  useEffect(() => {
    if (!listing) return;
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight" && n > 1) setI(x => (x + 1) % n);
      if (e.key === "ArrowLeft" && n > 1) setI(x => (x - 1 + n) % n);
    };
    window.addEventListener("keydown", key);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", key); document.body.style.overflow = prev; };
  }, [listing, n, onClose]);

  const gaps = listing ? listingGaps(listing) : { required: [], recommended: [] };
  const fact = (label: string, value: string) => value.trim() ? (
    <div className="py-2.5 border-b" style={{ borderColor: BORDER_L }}>
      <dt className="text-[9.5px] tracking-[0.24em] uppercase" style={{ color: MUTED_L, ...sans }}>{label}</dt>
      <dd className="mt-0.5 text-[14px]" style={{ color: FG_LIGHT, ...sans }}>{value}</dd>
    </div>
  ) : null;
  const btn = "inline-flex items-center justify-center gap-2 h-11 px-4 border text-[10.5px] tracking-[0.18em] uppercase whitespace-nowrap transition-colors";

  return (
    <AnimatePresence>
      {listing && (
        <motion.div className="fixed inset-0 z-[75] flex items-stretch md:items-center justify-center md:p-6" style={{ background: "rgba(10,9,8,0.8)", backdropFilter: "blur(6px)" }}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
          <motion.div role="dialog" aria-modal="true" aria-label={listing.title}
            className="relative w-full max-w-6xl h-full md:h-[min(780px,92vh)] flex flex-col md:grid md:grid-cols-[1.35fr_1fr] overflow-y-auto md:overflow-hidden shadow-2xl"
            style={{ background: WHITE }} onClick={e => e.stopPropagation()}
            initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 12, opacity: 0 }} transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}>

            {/* Photos */}
            <div className="relative shrink-0 h-[44vh] md:h-full flex flex-col" style={{ background: "#0d0c0a" }}>
              <div className="relative flex-1 min-h-0">
                {n ? (
                  <AnimatePresence mode="wait">
                    <motion.img key={photos[i]} src={photos[i]} alt={`Photo ${i + 1} of ${n}`} className="absolute inset-0 w-full h-full object-contain"
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} />
                  </AnimatePresence>
                ) : (
                  <p className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-[13px]" style={{ color: "rgba(240,235,224,0.6)", ...sans }}>
                    <ImageOff size={26} style={{ color: GOLD }} />The seller sent no photos
                  </p>
                )}
                {n > 1 && <>
                  <button type="button" onClick={() => setI(x => (x - 1 + n) % n)} aria-label="Previous photo"
                    className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full flex items-center justify-center transition-colors hover:bg-black/60" style={{ background: "rgba(0,0,0,0.4)", color: WHITE }}><ChevronLeft size={20} /></button>
                  <button type="button" onClick={() => setI(x => (x + 1) % n)} aria-label="Next photo"
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full flex items-center justify-center transition-colors hover:bg-black/60" style={{ background: "rgba(0,0,0,0.4)", color: WHITE }}><ChevronRight size={20} /></button>
                </>}
                {n > 0 && <span className="absolute left-4 top-4 px-2.5 py-1 text-[11px] tracking-[0.12em] tabular-nums" style={{ background: "rgba(0,0,0,0.55)", color: WHITE, ...sans }}>{i + 1} / {n}</span>}
              </div>
              {n > 1 && (
                <div className="shrink-0 flex gap-2 p-3 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
                  {photos.map((src, k) => (
                    <button key={src + k} type="button" onClick={() => setI(k)} aria-label={`Show photo ${k + 1}`}
                      className="shrink-0 w-20 h-14 overflow-hidden border-2 transition-opacity" style={{ borderColor: k === i ? GOLD : "transparent", opacity: k === i ? 1 : 0.55 }}>
                      <img src={src} alt="" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* What the seller sent, and the actions */}
            <div className="flex flex-col md:min-h-0">
              <div className="flex-1 md:overflow-y-auto px-6 md:px-8 pt-6 pb-6">
                <div className="flex items-center justify-between gap-3 mb-4">
                  <span className="text-[10px] tracking-[0.2em] uppercase px-2.5 py-1" style={{ background: listing.status === "new" ? "#d93636" : "rgba(176,136,72,0.15)", color: listing.status === "new" ? WHITE : "#7a5a24", ...sans }}>{LISTING_STATUS[listing.status]}</span>
                  <span className="flex items-center gap-3 text-[12px]" style={{ color: MUTED_L, ...sans }}>
                    Sent {timeAgo(listing.receivedAt)}
                    <button type="button" onClick={onClose} aria-label="Close" className="p-1.5 hover:text-[#8a2030]"><X size={18} /></button>
                  </span>
                </div>
                <h2 className="text-[26px] leading-tight" style={{ color: FG_LIGHT, ...serif }}>{listing.title || "Untitled"}</h2>
                <p className="mt-1.5 text-[13px]" style={{ color: MUTED_L, ...sans }}>{listing.type} · {listing.listing === "For Rent" ? "For rent" : "For sale"} · {listing.district}</p>

                <dl className="mt-5 grid grid-cols-2 gap-x-6">
                  {fact("Price asked", listing.price ? `NPR ${listing.price}` : "")}
                  {fact("Build year", listing.buildYear)}
                  {fact("Built area", listing.builtArea)}
                  {fact("Land area", listing.landArea)}
                </dl>
                {listing.description.trim() && <p className="mt-5 text-[14px] leading-relaxed" style={{ color: FG_LIGHT, ...sans }}>“{listing.description}”</p>}
                {listing.amenities.length > 0 && (
                  <div className="mt-5 flex flex-wrap gap-1.5">
                    {listing.amenities.map(a => <span key={a} className="px-2.5 py-1 border text-[12px]" style={{ borderColor: BORDER_L, color: FG_LIGHT, ...sans }}>{a}</span>)}
                  </div>
                )}

                {listing.status !== "published" && (gaps.required.length > 0 || gaps.recommended.length > 0) && (
                  <div className="mt-6">
                    <p className="text-[10px] tracking-[0.24em] uppercase mb-2" style={{ color: MUTED_L, ...sans }}>To add before publishing</p>
                    <div className="flex flex-wrap gap-1.5">
                      {gaps.required.map(g => <span key={g} className="px-2 py-0.5 text-[12px]" style={{ background: "rgba(138,32,48,0.1)", color: MAROON, ...sans }}>{g}</span>)}
                      {gaps.recommended.map(g => <span key={g} className="px-2 py-0.5 text-[12px]" style={{ background: "rgba(176,136,72,0.12)", color: "#7a5a24", ...sans }}>{g} (optional)</span>)}
                    </div>
                  </div>
                )}

                <div className="mt-6 border p-4" style={{ borderColor: "rgba(176,136,72,0.45)", background: "rgba(176,136,72,0.06)" }}>
                  <p className="flex items-center gap-2 text-[10px] tracking-[0.24em] uppercase mb-2" style={{ color: GOLD, ...sans }}><Lock size={12} />Seller · private</p>
                  <p className="text-[14px]" style={{ color: FG_LIGHT, ...sans }}>{listing.seller.name}</p>
                  <p className="text-[13px] mt-0.5 flex flex-wrap gap-x-4" style={{ color: MUTED_L, ...sans }}>
                    <a href={`tel:${listing.seller.phone.replace(/[^\d+]/g, "")}`} className="hover:text-[#8a2030]">{listing.seller.phone}</a>
                    {listing.seller.email && <a href={`mailto:${listing.seller.email}`} className="hover:text-[#8a2030]">{listing.seller.email}</a>}
                  </p>
                </div>
              </div>

              <div className="sticky bottom-0 shrink-0 border-t px-6 md:px-8 py-4 grid grid-cols-2 gap-2" style={{ borderColor: BORDER_L, background: WHITE }}>
                {listing.status === "published" ? (
                  <button type="button" onClick={() => onViewLive(listing)} className={`${btn} col-span-2`} style={{ background: MAROON, borderColor: MAROON, color: WHITE, ...sans }}><Eye size={14} />View on Website</button>
                ) : listing.status === "rejected" ? <>
                  <button type="button" onClick={() => onRestore(listing)} className={btn} style={{ borderColor: BORDER_L, color: FG_LIGHT, ...sans }}><Undo2 size={14} />Restore</button>
                  <button type="button" onClick={() => onReview(listing)} className={btn} style={{ background: MAROON, borderColor: MAROON, color: WHITE, ...sans }}><Pencil size={14} />Review & Edit</button>
                </> : <>
                  <button type="button" onClick={() => onReview(listing)} className={`${btn} col-span-2 hover:brightness-110`} style={{ background: MAROON, borderColor: MAROON, color: WHITE, ...sans }}><Pencil size={14} />Review & Edit</button>
                  {gaps.required.length === 0 && (
                    <button type="button" onClick={() => onPublish(listing)} className={`${btn} col-span-2 hover:border-[#8a2030]`} style={{ borderColor: GOLD, color: FG_LIGHT, background: "rgba(176,136,72,0.08)", ...sans }}><Send size={14} />Publish As It Is</button>
                  )}
                  <button type="button" onClick={() => onLater(listing)} disabled={listing.status === "draft"}
                    className={`${btn} hover:border-[#8a2030] disabled:opacity-50 disabled:cursor-default`} style={{ borderColor: BORDER_L, color: FG_LIGHT, ...sans }}>
                    <Clock size={14} />{listing.status === "draft" ? "Saved for Later" : "Save for Later"}
                  </button>
                  <button type="button" onClick={() => onReject(listing)} className={`${btn} hover:border-[#8a2030] hover:text-[#8a2030]`} style={{ borderColor: BORDER_L, color: MUTED_L, ...sans }}><X size={14} />Reject</button>
                </>}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
