import { useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ArrowRight, ChevronLeft, ChevronRight, Mail, MessageCircle, Phone, X } from "lucide-react";
import type { TeamMember } from "@/app/data/content";
import { BORDER_L, FG_LIGHT, GOLD, MAROON, MUTED_L, WHITE, sans, serif } from "./brand";
import { BackButton } from "./back-button";

/**
 * A team member's card: portrait in black and white that turns to colour on hover,
 * name and role. The whole card opens the profile pop-up.
 */
export function TeamCard({ m, onOpen }: { m: TeamMember; onOpen: () => void }) {
  return (
    <button type="button" onClick={onOpen} className="group text-left" aria-label={`View ${m.name}'s profile`}>
      <div className="relative overflow-hidden mb-4" style={{ aspectRatio: "4/5" }}>
        <img src={m.img} alt={m.name} className="w-full h-full object-cover grayscale group-hover:grayscale-0 group-hover:scale-[1.03] transition-all duration-700" />
        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500" style={{ background: "linear-gradient(to top, rgba(10,9,8,0.55) 0%, transparent 45%)" }} />
        <span className="absolute left-4 bottom-4 flex items-center gap-2 text-[10px] tracking-[0.26em] uppercase opacity-0 translate-y-1 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-500" style={{ color: WHITE, ...sans }}>
          View Profile <ArrowRight size={12} />
        </span>
      </div>
      <p className="text-base transition-colors group-hover:text-[#8a2030]" style={{ color: FG_LIGHT, ...serif }}>{m.name}</p>
      <p className="text-[12px] tracking-[0.15em] mt-0.5" style={{ color: MUTED_L, ...sans }}>{m.role}</p>
    </button>
  );
}

/**
 * The profile pop-up. `index` is the member shown within `members`; the arrows (and the
 * ← → keys) move to the previous / next colleague without closing. Escape, the × and
 * "Back to Team" close it.
 */
export function TeamProfile({ members, index, onIndex, onClose }: {
  members: TeamMember[]; index: number | null; onIndex: (i: number) => void; onClose: () => void;
}) {
  const open = index !== null && index >= 0 && index < members.length;
  const m = open ? members[index!] : null;
  const count = members.length;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight" && count > 1) onIndex((index! + 1) % count);
      if (e.key === "ArrowLeft" && count > 1) onIndex((index! - 1 + count) % count);
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [open, index, count, onIndex, onClose]);

  const circle = "w-10 h-10 rounded-full flex items-center justify-center border transition-colors hover:border-[#8a2030] hover:text-[#8a2030]";

  return (
    <AnimatePresence>
      {m && (
        <motion.div className="fixed inset-0 z-[65] flex items-center justify-center p-0 md:p-8"
          style={{ background: "rgba(10,9,8,0.78)", backdropFilter: "blur(6px)" }}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
          {/* Phones: photo on top, details below, the whole sheet scrolls. From md: side by side. */}
          <motion.div role="dialog" aria-modal="true" aria-label={`${m.name}, ${m.role}`}
            className="relative w-full max-w-5xl h-full md:h-auto md:max-h-[88vh] overflow-y-auto flex flex-col md:grid md:grid-cols-[0.9fr_1.1fr]"
            style={{ background: WHITE }}
            initial={{ y: 24, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 16, opacity: 0 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }} onClick={e => e.stopPropagation()}>

            {/* Portrait */}
            <AnimatePresence mode="wait">
              <motion.div key={`img-${m.id}`} className="relative overflow-hidden shrink-0 h-[52vh] md:h-auto md:min-h-[560px]"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
                <img src={m.img} alt={m.name} className="absolute inset-0 w-full h-full object-cover" />
                <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(10,9,8,0.45) 0%, transparent 40%)" }} />
                {m.department && (
                  <span className="absolute left-5 bottom-5 px-3 py-1 text-[10px] tracking-[0.25em] uppercase" style={{ background: MAROON, color: WHITE, ...sans }}>{m.department}</span>
                )}
              </motion.div>
            </AnimatePresence>

            {/* Details */}
            <div className="flex flex-col p-7 md:p-10 lg:p-12 min-w-0">
              <div className="flex items-center justify-between gap-3 mb-8">
                <BackButton label="Back to Team" onClick={onClose} />
                <div className="flex items-center gap-2 shrink-0">
                  {count > 1 && <>
                    <span className="hidden sm:inline text-[11px] tracking-[0.2em] tabular-nums mr-1" style={{ color: MUTED_L, ...sans }}>{index! + 1} / {count}</span>
                    <button type="button" aria-label="Previous team member" onClick={() => onIndex((index! - 1 + count) % count)} className={circle} style={{ borderColor: BORDER_L, color: FG_LIGHT }}><ChevronLeft size={16} /></button>
                    <button type="button" aria-label="Next team member" onClick={() => onIndex((index! + 1) % count)} className={circle} style={{ borderColor: BORDER_L, color: FG_LIGHT }}><ChevronRight size={16} /></button>
                  </>}
                  <button type="button" aria-label="Close profile" onClick={onClose} className={`${circle} ml-1`} style={{ borderColor: BORDER_L, color: MUTED_L }}><X size={16} /></button>
                </div>
              </div>

              <AnimatePresence mode="wait">
                <motion.div key={`txt-${m.id}`} className="flex flex-col"
                  initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }} transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}>
                  <div className="flex items-center gap-3 mb-4">
                    <div style={{ width: "2rem", height: "0.5px", background: GOLD }} />
                    <span className="text-[10px] tracking-[0.34em] uppercase" style={{ color: GOLD, ...sans }}>{m.role}</span>
                  </div>
                  <h2 className="leading-[0.95]" style={{ color: FG_LIGHT, ...serif, fontSize: "clamp(2rem,3.6vw,3rem)" }}>{m.name}</h2>
                  {!!m.experienceYears && (
                    <p className="mt-3 text-[13px] tracking-[0.08em]" style={{ color: MUTED_L, ...sans }}>{m.experienceYears} years with Nepal’s property market</p>
                  )}
                  {m.bio && <p className="mt-7 pt-7 border-t text-[15px] leading-[1.85]" style={{ borderColor: BORDER_L, color: MUTED_L, ...sans }}>{m.bio}</p>}

                  {!!m.specialities?.length && (
                    <div className="mt-7">
                      <p className="text-[10px] tracking-[0.28em] uppercase mb-3" style={{ color: FG_LIGHT, ...sans }}>Specialities</p>
                      <div className="flex flex-wrap gap-2">
                        {m.specialities.map(s => <span key={s} className="px-3 py-1.5 text-[12px] border" style={{ borderColor: "rgba(176,136,72,0.45)", color: FG_LIGHT, background: "rgba(176,136,72,0.06)", ...sans }}>{s}</span>)}
                      </div>
                    </div>
                  )}
                  {!!m.languages?.length && (
                    <p className="mt-6 text-[13px]" style={{ color: MUTED_L, ...sans }}>
                      <span className="text-[10px] tracking-[0.28em] uppercase mr-3" style={{ color: FG_LIGHT }}>Speaks</span>{m.languages.join(" · ")}
                    </p>
                  )}

                  {(m.phone || m.whatsapp || m.email) && (
                    <div className="mt-9 grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      {m.phone && <a href={`tel:${m.phone.replace(/\s/g, "")}`} className="flex items-center justify-center gap-2 py-3.5 text-[11px] tracking-[0.22em] uppercase transition-all hover:brightness-110" style={{ background: MAROON, color: WHITE, ...sans }}><Phone size={14} />Call</a>}
                      {m.whatsapp && <a href={`https://wa.me/${m.whatsapp.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 py-3.5 border text-[11px] tracking-[0.22em] uppercase transition-colors" style={{ borderColor: "#25D366", color: "#1f9e4d", background: "rgba(37,211,102,0.07)", ...sans }}><MessageCircle size={14} />WhatsApp</a>}
                      {m.email && <a href={`mailto:${m.email}`} className="flex items-center justify-center gap-2 py-3.5 border text-[11px] tracking-[0.22em] uppercase transition-colors hover:border-[#8a2030]" style={{ borderColor: BORDER_L, color: FG_LIGHT, ...sans }}><Mail size={14} />Email</a>}
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
