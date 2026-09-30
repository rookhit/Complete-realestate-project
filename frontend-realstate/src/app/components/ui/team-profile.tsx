import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ArrowRight, ChevronLeft, ChevronRight, Mail, MessageCircle, Phone, X } from "lucide-react";
import type { TeamMember } from "@/app/data/content";
import { BORDER_L, CREAM, FG_LIGHT, GOLD, MAROON, MUTED_L, WHITE, sans, serif } from "./brand";
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

const pad = (n: number) => String(n).padStart(2, "0");
const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join("").toUpperCase();
const EASE = [0.16, 1, 0.3, 1] as const;

/**
 * The profile pop-up. `index` is the member shown within `members`. Moving between
 * colleagues: the arrows, the ← → keys, the photo strip at the foot of the portrait, or a
 * swipe on the photo. Escape, the × and "Back to Team" close it.
 */
export function TeamProfile({ members, index, onIndex, onClose }: {
  members: TeamMember[]; index: number | null; onIndex: (i: number) => void; onClose: () => void;
}) {
  const open = index !== null && index >= 0 && index < members.length;
  const m = open ? members[index!] : null;
  const count = members.length;
  const sheet = useRef<HTMLDivElement>(null);
  const details = useRef<HTMLDivElement>(null);
  const strip = useRef<HTMLDivElement>(null);

  const step = (d: number) => { if (open && count > 1) onIndex((index! + d + count) % count); };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") step(1);
      if (e.key === "ArrowLeft") step(-1);
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [open, index, count, onIndex, onClose]);

  // New person: start their profile from the top and bring their thumbnail into view.
  useEffect(() => {
    if (!open) return;
    sheet.current?.scrollTo({ top: 0 });
    details.current?.scrollTo({ top: 0 });
    const row = strip.current, thumb = row?.querySelector<HTMLElement>(`[data-i="${index}"]`);
    if (row && thumb) row.scrollTo({ left: thumb.offsetLeft - (row.clientWidth - thumb.clientWidth) / 2, behavior: "smooth" });
  }, [open, index]);

  const circle = "w-10 h-10 rounded-full flex items-center justify-center border transition-colors hover:border-[#8a2030] hover:text-[#8a2030]";
  const first = m?.name.split(" ")[0] ?? "";
  const facts = m ? [
    m.experienceYears ? { k: "Experience", v: `${m.experienceYears} years` } : null,
    m.languages?.length ? { k: "Speaks", v: m.languages.join(" · ") } : null,
  ].filter((f): f is { k: string; v: string } => !!f) : [];

  return (
    <AnimatePresence>
      {m && (
        <motion.div className="fixed inset-0 z-[65] flex items-center justify-center p-0 md:p-8"
          style={{ background: "rgba(10,9,8,0.8)", backdropFilter: "blur(8px)" }}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
          {/* Phones: one scrolling sheet, photo on top, contact bar pinned to the bottom.
              From md: portrait left, details right, only the details scroll. */}
          <motion.div ref={sheet} role="dialog" aria-modal="true" aria-label={`${m.name}, ${m.role}`}
            className="relative w-full max-w-6xl h-full md:h-[min(720px,90vh)] overflow-y-auto md:overflow-hidden flex flex-col md:grid md:grid-cols-[5fr_7fr] shadow-2xl"
            style={{ background: CREAM }}
            initial={{ y: 28, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 16, opacity: 0 }}
            transition={{ duration: 0.45, ease: EASE }} onClick={e => e.stopPropagation()}>

            {/* Portrait */}
            <div className="relative overflow-hidden shrink-0 h-[56vh] md:h-full" style={{ background: "#0a0908" }}>
              <AnimatePresence initial={false}>
                <motion.img key={m.id} src={m.img} alt={m.name} draggable={false}
                  className="absolute inset-0 w-full h-full object-cover select-none touch-pan-y"
                  initial={{ opacity: 0, scale: 1.06 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
                  transition={{ opacity: { duration: 0.45 }, scale: { duration: 1.2, ease: EASE } }}
                  drag={count > 1 ? "x" : false} dragConstraints={{ left: 0, right: 0 }} dragElastic={0.15}
                  onDragEnd={(_, info) => { if (info.offset.x < -60) step(1); else if (info.offset.x > 60) step(-1); }} />
              </AnimatePresence>
              <div className="absolute inset-0 pointer-events-none" style={{ background: "linear-gradient(to top, rgba(10,9,8,0.85) 0%, rgba(10,9,8,0.25) 38%, transparent 60%), linear-gradient(to bottom, rgba(10,9,8,0.35) 0%, transparent 22%)" }} />
              <div className="absolute inset-3 md:inset-5 border pointer-events-none" style={{ borderColor: "rgba(176,136,72,0.5)" }} />

              {count > 1 && (
                <p className="absolute left-7 top-7 md:left-10 md:top-10 flex items-baseline gap-2 pointer-events-none" style={{ color: WHITE }}>
                  <span className="text-[34px] leading-none tabular-nums" style={serif}>{pad(index! + 1)}</span>
                  <span className="text-[11px] tracking-[0.25em]" style={{ color: "rgba(255,255,255,0.65)", ...sans }}>/ {pad(count)}</span>
                </p>
              )}

              <div className="absolute left-7 right-7 bottom-7 md:left-10 md:right-10 md:bottom-10">
                {m.department && (
                  <span className="inline-block px-3 py-1 mb-4 text-[10px] tracking-[0.25em] uppercase" style={{ background: MAROON, color: WHITE, ...sans }}>{m.department}</span>
                )}
                {count > 1 && (
                  <div ref={strip} className="flex gap-2.5 overflow-x-auto py-1 px-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" aria-label="Team members">
                    {members.map((p, i) => {
                      const on = i === index;
                      return (
                        <button key={p.id} type="button" data-i={i} onClick={() => onIndex(i)} aria-label={`Show ${p.name}`} aria-current={on || undefined}
                          title={p.name}
                          className="shrink-0 w-11 h-11 rounded-full overflow-hidden transition-all duration-300 hover:opacity-100"
                          style={{ outline: `1.5px solid ${on ? GOLD : "transparent"}`, outlineOffset: 2, opacity: on ? 1 : 0.55 }}>
                          <img src={p.img} alt="" className={`w-full h-full object-cover ${on ? "" : "grayscale"}`} />
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Details */}
            <div className="relative flex flex-col min-w-0 md:min-h-0">
              <span aria-hidden className="absolute right-6 md:right-12 bottom-28 md:bottom-32 leading-none select-none pointer-events-none"
                style={{ ...serif, fontSize: "clamp(120px,14vw,190px)", color: "transparent", WebkitTextStroke: "1px rgba(176,136,72,0.22)" }}>
                {initials(m.name)}
              </span>

              <div ref={details} className="relative flex-1 md:overflow-y-auto px-7 md:px-12 lg:px-14 pt-7 md:pt-10 pb-10">
                <div className="flex items-center justify-between gap-3 mb-10">
                  <BackButton label="Back to Team" onClick={onClose} />
                  <div className="flex items-center gap-2 shrink-0">
                    {count > 1 && <>
                      <button type="button" aria-label="Previous team member" onClick={() => step(-1)} className={circle} style={{ borderColor: BORDER_L, color: FG_LIGHT, background: WHITE }}><ChevronLeft size={16} /></button>
                      <button type="button" aria-label="Next team member" onClick={() => step(1)} className={circle} style={{ borderColor: BORDER_L, color: FG_LIGHT, background: WHITE }}><ChevronRight size={16} /></button>
                    </>}
                    <button type="button" aria-label="Close profile" onClick={onClose} className={`${circle} ml-1`} style={{ borderColor: BORDER_L, color: MUTED_L, background: WHITE }}><X size={16} /></button>
                  </div>
                </div>

                <AnimatePresence mode="wait">
                  <motion.div key={m.id}
                    initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.35, ease: EASE }}>
                    <div className="flex items-center gap-3 mb-4">
                      <div style={{ width: "2rem", height: "0.5px", background: GOLD }} />
                      <span className="text-[10px] tracking-[0.34em] uppercase" style={{ color: GOLD, ...sans }}>{m.role}</span>
                    </div>
                    <h2 className="leading-[0.95] pr-4" style={{ color: FG_LIGHT, ...serif, fontSize: "clamp(2.3rem,4.2vw,3.6rem)" }}>{m.name}</h2>

                    {facts.length > 0 && (
                      <dl className="mt-8 grid border-y" style={{ borderColor: BORDER_L, gridTemplateColumns: `repeat(${facts.length}, minmax(0,1fr))` }}>
                        {facts.map((f, i) => (
                          <div key={f.k} className={`py-4 ${i ? "pl-4 md:pl-6 border-l" : ""} ${i < facts.length - 1 ? "pr-3" : ""}`} style={{ borderColor: BORDER_L }}>
                            <dt className="text-[9.5px] tracking-[0.28em] uppercase mb-1.5" style={{ color: MUTED_L, ...sans }}>{f.k}</dt>
                            <dd className="text-[15px] md:text-[16px] leading-snug" style={{ color: FG_LIGHT, ...serif }}>{f.v}</dd>
                          </div>
                        ))}
                      </dl>
                    )}

                    {m.bio && (
                      <blockquote className="relative mt-9 pl-7 md:pl-9">
                        <span aria-hidden className="absolute left-0 -top-3 text-[56px] leading-none" style={{ color: GOLD, ...serif }}>“</span>
                        <p className="text-[17px] md:text-[18px] leading-[1.6]" style={{ color: FG_LIGHT, ...serif }}>{m.bio}</p>
                      </blockquote>
                    )}

                    {!!m.specialities?.length && (
                      <div className="mt-9">
                        <p className="text-[10px] tracking-[0.28em] uppercase mb-3.5" style={{ color: MUTED_L, ...sans }}>Known for</p>
                        <div className="flex flex-wrap gap-2">
                          {m.specialities.map(s => (
                            <span key={s} className="inline-flex items-center gap-2 px-3.5 py-2 text-[12.5px] border" style={{ borderColor: BORDER_L, color: FG_LIGHT, background: WHITE, ...sans }}>
                              <span className="w-1.5 h-1.5 rotate-45" style={{ background: GOLD }} />{s}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </motion.div>
                </AnimatePresence>
              </div>

              {(m.phone || m.whatsapp || m.email) && (
                <div className="sticky bottom-0 md:static shrink-0 flex items-center gap-3 px-5 md:px-12 lg:px-14 py-4 md:py-5 border-t"
                  style={{ borderColor: BORDER_L, background: WHITE }}>
                  <div className="hidden sm:block flex-1 min-w-0">
                    <p className="text-[10px] tracking-[0.28em] uppercase" style={{ color: MUTED_L, ...sans }}>Speak with {first}</p>
                    {m.phone && <p className="mt-1 text-[17px] truncate" style={{ color: FG_LIGHT, ...serif }}>{m.phone}</p>}
                  </div>
                  {m.phone && (
                    <a href={`tel:${m.phone.replace(/\s/g, "")}`} className="flex-1 sm:flex-none flex items-center justify-center gap-2 h-12 px-6 text-[11px] tracking-[0.22em] uppercase transition-all hover:brightness-110"
                      style={{ background: MAROON, color: WHITE, ...sans }}><Phone size={14} />Call {first}</a>
                  )}
                  {m.whatsapp && (
                    <a href={`https://wa.me/${m.whatsapp.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer" aria-label={`WhatsApp ${first}`} title="WhatsApp"
                      className="shrink-0 w-12 h-12 flex items-center justify-center border transition-colors hover:bg-[rgba(37,211,102,0.08)]"
                      style={{ borderColor: "rgba(37,211,102,0.6)", color: "#1f9e4d" }}><MessageCircle size={18} /></a>
                  )}
                  {m.email && (
                    <a href={`mailto:${m.email}`} aria-label={`Email ${first}`} title={m.email}
                      className="shrink-0 w-12 h-12 flex items-center justify-center border transition-colors hover:border-[#8a2030] hover:text-[#8a2030]"
                      style={{ borderColor: BORDER_L, color: FG_LIGHT }}><Mail size={18} /></a>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
