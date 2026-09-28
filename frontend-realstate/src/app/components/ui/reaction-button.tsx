import { useState } from "react";
import { motion } from "motion/react";
import { Heart } from "lucide-react";
import { BORDER_L, MAROON, MUTED_L, sans } from "./brand";
import { reactionCount } from "@/app/data/reviews";

// Properties this visitor has hearted. Lost on reload for now;
// becomes GET/PUT/DELETE /api/v1/me/favourites once that exists.
export const FAVS = new Set<number>();

/** Heart button with the reaction count next to it. */
export function ReactionButton({ id, size = "md" }: { id: number; size?: "sm" | "md" }) {
  const [on, setOn] = useState(FAVS.has(id));
  const sm = size === "sm";
  const toggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    const next = !on;
    if (next) FAVS.add(id); else FAVS.delete(id);
    setOn(next);
  };
  return (
    <button
      onClick={toggle}
      aria-label={on ? "Remove your reaction" : "React to this property"}
      aria-pressed={on}
      className={`flex items-center border transition-all hover:border-[#8a2030] ${sm ? "gap-1.5 px-2.5 py-2" : "gap-2 px-3.5 py-2.5"}`}
      style={{ borderColor: on ? MAROON : BORDER_L, color: on ? MAROON : MUTED_L, background: "transparent" }}
    >
      <motion.span
        key={String(on)}
        initial={{ scale: on ? 0.7 : 1 }} animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 520, damping: 16 }}
        className="flex"
      >
        <Heart size={sm ? 14 : 15} fill={on ? MAROON : "none"} />
      </motion.span>
      <span className={`tabular-nums ${sm ? "text-[12px]" : "text-[13px]"}`} style={{ ...sans }}>
        {reactionCount(id, on)}
      </span>
    </button>
  );
}

/** Icon-only save button, for tight spots such as over a photo on the map view. */
export function FavButton({ id, light = false }: { id: number; light?: boolean }) {
  const [on, setOn] = useState(FAVS.has(id));
  const toggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    const n = !on;
    if (n) FAVS.add(id); else FAVS.delete(id);
    setOn(n);
  };
  return (
    <button aria-label={on ? "Remove from saved" : "Save property"} onClick={toggle}
      className="p-2 border transition-all hover:border-[#8a2030]"
      style={{ borderColor: on ? MAROON : (light ? "rgba(255,255,255,0.6)" : BORDER_L), color: on ? MAROON : MUTED_L, background: light ? "rgba(255,255,255,0.9)" : "transparent" }}>
      <Heart size={15} fill={on ? MAROON : "none"} />
    </button>
  );
}
