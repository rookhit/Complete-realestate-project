import { useState } from "react";
import { motion } from "motion/react";
import { Bath, Bed, CheckCircle2, MapPin, Play, Square } from "lucide-react";
import type { Prop } from "@/app/data/properties";
import { FG_DARK, FG_LIGHT, GOLD, MAROON, MUTED_D, MUTED_L, WHITE, sans, serif } from "./brand";
import { StatusBadge } from "./status-badge";

/**
 * The two property card designs the site uses. They live here, rather than in App.tsx,
 * so the admin's live preview renders exactly the same card the visitor will see.
 */

/**
 * The standard card: New Listings, the Buy/Rent grid, and "You May Also Like".
 * Hovering the photo reveals beds, baths and area; `showDetails` keeps them visible
 * (the admin preview uses it so the editor can see them without hovering).
 */
export function ListingCard({ p, onOpen, light = false, showDetails = false }: {
  p: Prop; onOpen?: () => void; light?: boolean; showDetails?: boolean;
}) {
  const [hov, setHov] = useState(false);
  const on = hov || showDetails;
  return (
    <div className={`group flex flex-col ${onOpen ? "cursor-pointer" : ""}`} onClick={onOpen} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}>
      <div className="relative overflow-hidden" style={{ aspectRatio: "4/3", background: "#e9e3d8" }}>
        {p.hero && <img src={p.hero} alt={p.title} className="w-full h-full object-cover transition-transform duration-700" style={{ transform: hov ? "scale(1.05)" : "scale(1)" }} />}
        <div className="absolute inset-0 transition-opacity duration-400" style={{ background: "linear-gradient(to top, rgba(10,9,8,0.75) 0%, transparent 55%)", opacity: on ? 1 : 0.5 }} />
        <div className="absolute top-3 left-3 flex gap-1.5">
          <span className="px-2.5 py-1 text-[10px] tracking-[0.25em] uppercase" style={{ background: MAROON, color: WHITE, ...sans }}>{p.badge}</span>
        </div>
        {/* The corner badge already says "Featured" when that is the badge, so
            the status chip must not repeat it. */}
        <div className="absolute top-3 right-3"><StatusBadge verified={p.verified} featured={p.featured && p.badge !== "Featured"} onImage /></div>
        <motion.div className="absolute bottom-3 left-3 right-3 flex gap-3" animate={{ opacity: on ? 1 : 0, y: on ? 0 : 6 }} transition={{ duration: 0.25 }}>
          {p.beds > 0 && <span className="flex items-center gap-1 text-[11px]" style={{ color: "rgba(240,235,224,0.8)", ...sans }}><Bed size={12} />{p.beds}</span>}
          {p.baths > 0 && <span className="flex items-center gap-1 text-[11px]" style={{ color: "rgba(240,235,224,0.8)", ...sans }}><Bath size={12} />{p.baths}</span>}
          {p.builtArea !== "—" && <span className="flex items-center gap-1 text-[11px]" style={{ color: "rgba(240,235,224,0.8)", ...sans }}><Square size={12} />{p.builtArea}</span>}
        </motion.div>
      </div>
      <div className={`flex flex-col ${light ? "px-7 pt-7 pb-8" : "pt-6"}`} style={{ background: light ? WHITE : "transparent" }}>
        <span className="text-[10px] tracking-[0.24em] uppercase mb-3" style={{ color: light ? MUTED_L : MUTED_D, ...sans }}>{p.type}</span>
        <h3 className="leading-[1.22] text-[1.3rem] mb-2.5" style={{ color: light ? FG_LIGHT : FG_DARK, ...serif }}>{p.title}</h3>
        <div className="flex items-center gap-1.5 min-w-0 mb-4">
          <MapPin size={12} style={{ color: GOLD, flexShrink: 0 }} />
          <span className="text-[13px] truncate" style={{ color: light ? MUTED_L : MUTED_D, ...sans }}>{p.location}</span>
        </div>
        <span className="text-[17px] font-medium tracking-[0.01em]" style={{ color: light ? MAROON : GOLD, ...sans }}>{p.price}</span>
      </div>
    </div>
  );
}

/** The Hot Properties card on the home page: video-style photo with a play mark. */
export function HotCard({ p, onOpen }: { p: Prop; onOpen?: () => void }) {
  return (
    <div className={`shrink-0 flex flex-col gap-5 group ${onOpen ? "cursor-pointer" : ""}`} style={{ width: "clamp(300px,30vw,380px)", maxWidth: "100%" }} onClick={onOpen}>
      {/* Video thumbnail style */}
      <div className="relative overflow-hidden" style={{ aspectRatio: "4/3", background: "#e9e3d8" }}>
        {p.hero && <img src={p.hero} alt={p.title} className="w-full h-full object-cover transition-transform duration-600 group-hover:scale-[1.04]" />}
        <div className="absolute inset-0" style={{ background: "rgba(0,0,0,0.28)" }} />
        {/* Play button */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-12 h-12 flex items-center justify-center border-2 border-white rounded-full bg-black/30 group-hover:bg-white/20 transition-all">
            <Play size={18} fill="white" style={{ color: "white", marginLeft: 2 }} />
          </div>
        </div>
        <div className="absolute top-3 left-3"><span className="px-2 py-0.5 text-[10px] tracking-[0.25em] uppercase" style={{ background: MAROON, color: WHITE, ...sans }}>{p.badge}</span></div>
        {p.verified && <div className="absolute top-3 right-3"><CheckCircle2 size={16} style={{ color: "rgba(176,136,72,0.9)" }} /></div>}
      </div>
      {/* Same caption rhythm as the New Listings cards beside it. */}
      <div className="flex flex-col gap-1.5 px-0.5">
        <p className="text-[11px] tracking-[0.25em] uppercase" style={{ color: MUTED_L, ...sans }}>{p.type}</p>
        <p className="text-[19px] leading-tight" style={{ color: FG_LIGHT, ...serif }}>{p.title}</p>
        <p className="flex items-center gap-1.5 text-[13px]" style={{ color: MUTED_L, ...sans }}><MapPin size={12} style={{ color: GOLD }} />{p.location}</p>
        <p className="text-[16px] font-medium mt-1" style={{ color: MAROON, ...sans }}>{p.price}</p>
      </div>
    </div>
  );
}
