import { useEffect, useRef } from "react";
import { motion } from "motion/react";
import { X } from "lucide-react";
import { DASHAIN, PALETTE, type DashainPage } from "./config";
import { Ribbons } from "./Ribbons";

// The Dashain greeting: a maroon-and-gold card under a marigold toran, with jamara in the corners
// and festival ribbons falling behind it. Opened once per visit by index.tsx.

const serif = { fontFamily: "'Gloock', serif" };
const sans = { fontFamily: "'Jost', sans-serif" };
const deva = { fontFamily: "'Noto Serif Devanagari', 'Nirmala UI', 'Mangal', serif" };

/** A marigold toran (door garland): swags of flowers with mango leaves hanging between them. */
function Toran() {
  const W = 560, SWAGS = 6, DIP = 24, R = 4.6;
  const span = W / SWAGS;
  const flowers: { x: number; y: number; c: string }[] = [];
  for (let s = 0; s < SWAGS; s++) {
    for (let i = 0; i <= 12; i++) {
      const t = i / 12, x = s * span + t * span;
      flowers.push({ x, y: 8 + Math.sin(Math.PI * t) * DIP, c: i % 2 ? PALETTE.saffron : PALETTE.marigold });
    }
  }
  return (
    <svg viewBox={`0 0 ${W} 74`} className="w-full h-auto block" aria-hidden="true">
      <line x1="0" y1="7" x2={W} y2="7" stroke={PALETTE.gold} strokeWidth="1.2" />
      {Array.from({ length: SWAGS + 1 }, (_, j) => {
        const x = j * span;
        return (
          <g key={j}>
            {[0, 1, 2].map(k => <circle key={k} cx={x} cy={14 + k * 9} r={R} fill={k % 2 ? PALETTE.saffron : PALETTE.marigold} />)}
            <path d={`M ${x} 38 q -7 9 0 22 q 7 -13 0 -22 z`} fill={PALETTE.jamaraDeep} />
            <path d={`M ${x} 39 l 0 19`} stroke={PALETTE.jamara} strokeWidth="0.8" />
          </g>
        );
      })}
      {flowers.map((f, i) => <circle key={i} cx={f.x} cy={f.y} r={R} fill={f.c} />)}
      {flowers.filter((_, i) => i % 3 === 0).map((f, i) => <circle key={`h${i}`} cx={f.x - 1.2} cy={f.y - 1.4} r={1.4} fill="#fff3c4" opacity="0.7" />)}
    </svg>
  );
}

/** A sprig of jamara (sacred barley shoots) tied with red thread. */
function Jamara({ flip = false }: { flip?: boolean }) {
  const blades = [[-14, 70], [-9, 84], [-4, 92], [0, 98], [4, 90], [9, 82], [14, 68], [-18, 56], [18, 58]];
  return (
    <svg viewBox="-30 -104 60 110" className="w-full h-full" aria-hidden="true" style={{ transform: flip ? "scaleX(-1)" : undefined }}>
      {blades.map(([dx, len], i) => (
        <path key={i} d={`M 0 0 Q ${dx * 0.4} ${-len * 0.55} ${dx} ${-len}`} fill="none"
          stroke={i % 2 ? PALETTE.jamara : "#c3d86a"} strokeWidth="2.4" strokeLinecap="round" />
      ))}
      <rect x="-6" y="-8" width="12" height="5" rx="1.5" fill={PALETTE.sindoor} />
    </svg>
  );
}

/** Red tika with a gold ring and grains of rice. */
function Tika() {
  return (
    <svg viewBox="0 0 40 40" className="w-9 h-9" aria-hidden="true">
      <defs>
        <radialGradient id="dashain-tika" cx="40%" cy="35%" r="65%">
          <stop offset="0%" stopColor="#ff5a4f" /><stop offset="70%" stopColor={PALETTE.sindoor} /><stop offset="100%" stopColor="#8e1820" />
        </radialGradient>
      </defs>
      <circle cx="20" cy="20" r="18" fill="none" stroke={PALETTE.gold} strokeWidth="1" opacity="0.8" />
      <circle cx="20" cy="20" r="12" fill="url(#dashain-tika)" />
      {[[16, 16, 20], [23, 18, -30], [19, 24, 60]].map(([x, y, r], i) => (
        <ellipse key={i} cx={x} cy={y} rx="2" ry="1" fill="#fffaf0" transform={`rotate(${r} ${x} ${y})`} />
      ))}
    </svg>
  );
}

/** A thin gold rule with a small kite in the middle. */
function KiteRule() {
  return (
    <div className="flex items-center gap-3 w-full max-w-[16rem]" aria-hidden="true">
      <span className="h-px flex-1" style={{ background: `linear-gradient(to right, transparent, ${PALETTE.gold})` }} />
      <svg viewBox="0 0 16 20" className="w-3 h-4"><path d="M8 0 L16 8 L8 20 L0 8 Z" fill={PALETTE.gold} /><path d="M8 0 L8 20 M0 8 L16 8" stroke={PALETTE.maroon} strokeWidth="0.8" /></svg>
      <span className="h-px flex-1" style={{ background: `linear-gradient(to left, transparent, ${PALETTE.gold})` }} />
    </div>
  );
}

export default function DashainPopup({ onClose, onNavigate }: { onClose: () => void; onNavigate: (page: DashainPage) => void }) {
  const closeBtn = useRef<HTMLButtonElement>(null);
  const { copy } = DASHAIN;

  // Focus the dialog on open and give focus back on close; Escape closes.
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    closeBtn.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => { window.removeEventListener("keydown", onKey); before?.focus?.({ preventScroll: true }); };
  }, [onClose]);

  const go = (page: DashainPage) => { onClose(); onNavigate(page); };
  const ease = [0.16, 1, 0.3, 1] as const;

  return (
    <motion.div className="fixed inset-0 z-[150] flex items-center justify-center p-4 sm:p-6"
      style={{ background: "rgba(14,8,6,0.66)", backdropFilter: "blur(5px)" }}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.4 }}
      onClick={onClose}>
      <Ribbons />
      <motion.div role="dialog" aria-modal="true" aria-labelledby="dashain-title" aria-describedby="dashain-message"
        className="relative w-full max-w-[560px]"
        initial={{ opacity: 0, y: 28, scale: 0.94 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 14, scale: 0.98 }}
        transition={{ duration: 0.7, ease }} onClick={e => e.stopPropagation()}>
      <div className="relative max-h-[calc(100dvh-2rem)] overflow-y-auto overflow-x-hidden text-center shadow-2xl"
        style={{ background: `radial-gradient(120% 90% at 50% 0%, ${PALETTE.crimson} 0%, ${PALETTE.maroon} 48%, ${PALETTE.maroonDeep} 100%)`, border: `1px solid ${PALETTE.gold}` }}>
        {/* Inner gold frame. */}
        <div className="absolute inset-2.5 pointer-events-none" style={{ border: `1px solid ${PALETTE.gold}55` }} />

        <motion.div className="relative px-3 pt-1" initial={{ y: -26, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.9, ease, delay: 0.15 }}>
          <Toran />
        </motion.div>

        <div className="relative px-6 sm:px-12 pt-2 pb-9 sm:pb-11 flex flex-col items-center gap-3.5">
          <motion.div initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 260, damping: 16, delay: 0.45 }}>
            <Tika />
          </motion.div>
          <motion.p className="text-[19px] sm:text-[22px] leading-tight" style={{ ...deva, color: PALETTE.goldSoft }} lang="ne"
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.55, duration: 0.6 }}>
            {copy.eyebrow}
          </motion.p>
          <motion.h2 id="dashain-title" className="leading-[0.95]" style={{ ...serif, color: PALETTE.cream, fontSize: "clamp(2.6rem, 9vw, 3.9rem)" }}
            initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.68, duration: 0.8, ease }}>
            {copy.title}
          </motion.h2>
          <motion.div className="w-full flex justify-center" initial={{ opacity: 0, scaleX: 0.4 }} animate={{ opacity: 1, scaleX: 1 }} transition={{ delay: 0.85, duration: 0.7, ease }}>
            <KiteRule />
          </motion.div>
          <motion.p className="px-4 py-1.5 text-[11px] sm:text-[12px] tracking-[0.32em] uppercase"
            style={{ ...sans, color: PALETTE.maroonDeep, background: `linear-gradient(90deg, ${PALETTE.gold}, ${PALETTE.goldSoft}, ${PALETTE.gold})`, fontWeight: 600 }}
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.95 }}>
            {copy.offers}
          </motion.p>
          <motion.p id="dashain-message" className="max-w-[26rem] text-[14px] sm:text-[15px] leading-relaxed" style={{ ...sans, color: `${PALETTE.cream}d9` }}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.05, duration: 0.6 }}>
            {copy.message}
          </motion.p>
          <motion.div className="mt-2 w-full flex flex-col sm:flex-row gap-3 justify-center" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.15 }}>
            <button type="button" onClick={() => go(copy.primary.page)}
              className="px-7 py-3.5 text-[11px] tracking-[0.25em] uppercase transition-[filter,transform] hover:brightness-110 active:scale-[0.98]"
              style={{ ...sans, background: PALETTE.gold, color: PALETTE.maroonDeep, fontWeight: 600 }}>{copy.primary.label}</button>
            <button type="button" onClick={() => go(copy.secondary.page)}
              className="px-7 py-3.5 text-[11px] tracking-[0.25em] uppercase border transition-colors hover:bg-white/10"
              style={{ ...sans, borderColor: `${PALETTE.cream}66`, color: PALETTE.cream }}>{copy.secondary.label}</button>
          </motion.div>
          <motion.p className="mt-2 text-[13px] sm:text-[14px]" style={{ ...deva, color: PALETTE.goldSoft }} lang="ne"
            initial={{ opacity: 0 }} animate={{ opacity: 0.9 }} transition={{ delay: 1.3 }}>
            {copy.blessing}
          </motion.p>
        </div>

        {/* Jamara in the bottom corners. */}
        <motion.div className="absolute left-1 sm:left-3 bottom-1 w-10 sm:w-14 h-[4.5rem] sm:h-24 pointer-events-none" style={{ transformOrigin: "bottom center" }}
          initial={{ scaleY: 0 }} animate={{ scaleY: 1 }} transition={{ delay: 0.9, duration: 0.9, ease }}><Jamara /></motion.div>
        <motion.div className="absolute right-1 sm:right-3 bottom-1 w-10 sm:w-14 h-[4.5rem] sm:h-24 pointer-events-none" style={{ transformOrigin: "bottom center" }}
          initial={{ scaleY: 0 }} animate={{ scaleY: 1 }} transition={{ delay: 1, duration: 0.9, ease }}><Jamara flip /></motion.div>
      </div>

        {/* On the card's corner, clear of the garland. */}
        <button ref={closeBtn} type="button" onClick={onClose} aria-label={copy.close}
          className="absolute -top-3.5 -right-2 sm:-right-3.5 w-10 h-10 flex items-center justify-center rounded-full shadow-lg transition-[transform,filter] hover:brightness-125 hover:rotate-90 duration-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
          style={{ color: PALETTE.cream, background: PALETTE.maroonDeep, border: `1px solid ${PALETTE.gold}`, outlineColor: PALETTE.goldSoft }}>
          <X size={17} />
        </button>
      </motion.div>
    </motion.div>
  );
}
