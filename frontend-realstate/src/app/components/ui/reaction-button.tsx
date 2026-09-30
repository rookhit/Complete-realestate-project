import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Heart } from "lucide-react";
import { BORDER_L, GOLD, MAROON, MUTED_L, sans } from "./brand";
import { reactionCount } from "@/app/data/reviews";

// Properties this visitor has hearted. Lost on reload for now;
// becomes GET/PUT/DELETE /api/v1/me/favourites once that exists.
export const FAVS = new Set<number>();

const PARTICLES = Array.from({ length: 8 }, (_, i) => {
  const a = (i / 8) * Math.PI * 2 - Math.PI / 2;
  return { x: Math.cos(a), y: Math.sin(a), color: i % 2 ? GOLD : MAROON };
});

/**
 * The heart itself, Instagram style: it pops in with a spring, a ring and a spray of
 * gold and maroon dots burst out when it is liked, and it grows a little on hover.
 * `burst` changes on every like, which replays the animation.
 */
function AnimatedHeart({ on, burst, size }: { on: boolean; burst: number; size: number }) {
  const reach = size * 1.35;
  return (
    <span className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <AnimatePresence>
        {on && burst > 0 && (
          <motion.span key={burst} className="absolute inset-0 pointer-events-none" initial={{ opacity: 1 }} animate={{ opacity: 0 }} transition={{ delay: 0.45, duration: 0.2 }}>
            <motion.span className="absolute inset-0 rounded-full" style={{ border: `2px solid ${MAROON}` }}
              initial={{ scale: 0.2, opacity: 0.9 }} animate={{ scale: 2.2, opacity: 0 }} transition={{ duration: 0.5, ease: "easeOut" }} />
            {PARTICLES.map((p, i) => (
              <motion.span key={i} className="absolute left-1/2 top-1/2 rounded-full" style={{ width: 4, height: 4, marginLeft: -2, marginTop: -2, background: p.color }}
                initial={{ x: 0, y: 0, scale: 0.4, opacity: 1 }} animate={{ x: p.x * reach, y: p.y * reach, scale: 1, opacity: 0 }}
                transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }} />
            ))}
          </motion.span>
        )}
      </AnimatePresence>
      <motion.span key={`${on}-${burst}`} className="flex transition-transform duration-200 group-hover:scale-[1.15]"
        initial={{ scale: on ? 0.2 : 0.8 }} animate={{ scale: on ? [0.2, 1.35, 0.92, 1] : 1 }}
        transition={on ? { duration: 0.5, times: [0, 0.45, 0.75, 1], ease: "easeOut" } : { type: "spring", stiffness: 500, damping: 18 }}>
        <Heart size={size} fill={on ? MAROON : "none"} strokeWidth={on ? 1.5 : 1.75} />
      </motion.span>
    </span>
  );
}

/** A number that rolls up when it grows and down when it shrinks. */
function RollingCount({ value, className }: { value: number; className: string }) {
  const [prev, setPrev] = useState(value);
  const up = value >= prev;
  if (value !== prev) setPrev(value);
  return (
    <span className={`relative inline-flex overflow-hidden tabular-nums ${className}`} style={{ ...sans }}>
      <AnimatePresence initial={false} mode="popLayout">
        <motion.span key={value} initial={{ y: up ? "100%" : "-100%", opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: up ? "-100%" : "100%", opacity: 0 }}
          transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}>{value}</motion.span>
      </AnimatePresence>
    </span>
  );
}

function useHeart(id: number) {
  const [on, setOn] = useState(FAVS.has(id));
  const [burst, setBurst] = useState(0);
  const toggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    const next = !on;
    if (next) { FAVS.add(id); setBurst(b => b + 1); } else FAVS.delete(id);
    setOn(next);
  };
  return { on, burst, toggle };
}

/** Heart button with the reaction count next to it. */
export function ReactionButton({ id, size = "md" }: { id: number; size?: "sm" | "md" }) {
  const { on, burst, toggle } = useHeart(id);
  const sm = size === "sm";
  return (
    <button
      onClick={toggle}
      aria-label={on ? "Remove your reaction" : "React to this property"}
      aria-pressed={on}
      className={`group flex items-center border transition-all duration-200 hover:border-[#8a2030] hover:bg-[rgba(138,32,48,0.05)] hover:shadow-[0_4px_14px_rgba(138,32,48,0.12)] active:scale-95 ${sm ? "gap-1.5 px-2.5 py-2" : "gap-2 px-3.5 py-2.5"}`}
      style={{ borderColor: on ? MAROON : BORDER_L, color: on ? MAROON : MUTED_L, background: on ? "rgba(138,32,48,0.06)" : "transparent" }}
    >
      <AnimatedHeart on={on} burst={burst} size={sm ? 14 : 16} />
      <RollingCount value={reactionCount(id, on)} className={sm ? "text-[12px]" : "text-[13px]"} />
    </button>
  );
}

/** Icon-only save button, for tight spots such as over a photo on the map view. */
export function FavButton({ id, light = false }: { id: number; light?: boolean }) {
  const { on, burst, toggle } = useHeart(id);
  return (
    <button aria-label={on ? "Remove from saved" : "Save property"} aria-pressed={on} onClick={toggle}
      className="group p-2 border transition-all duration-200 hover:border-[#8a2030] active:scale-95"
      style={{ borderColor: on ? MAROON : (light ? "rgba(255,255,255,0.6)" : BORDER_L), color: on ? MAROON : MUTED_L, background: light ? "rgba(255,255,255,0.92)" : "transparent" }}>
      <AnimatedHeart on={on} burst={burst} size={15} />
    </button>
  );
}
