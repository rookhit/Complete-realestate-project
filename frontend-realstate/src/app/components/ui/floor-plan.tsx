import { useState } from "react";
import type { FloorPlan } from "@/app/data/properties";
import { BORDER_L, CREAM, FG_LIGHT, GOLD, MUTED_L, WHITE, sans } from "./brand";

/**
 * The floor plans an admin uploaded for a property: one tab per floor, the
 * drawing (when there is one) and the list of rooms with their sizes.
 */
export function FloorPlanViewer({ plans }: { plans: FloorPlan[] }) {
  const [active, setActive] = useState(0);
  const plan = plans[Math.min(active, plans.length - 1)];
  if (!plan) return null;
  return (
    <div className="border" style={{ borderColor: BORDER_L, background: WHITE }}>
      {plans.length > 1 && (
        <div className="flex overflow-x-auto border-b" style={{ borderColor: BORDER_L, scrollbarWidth: "none" }}>
          {plans.map((p, i) => (
            <button key={p.id} onClick={() => setActive(i)} aria-pressed={i === active}
              className="relative px-5 py-3.5 text-[11px] tracking-[0.2em] uppercase whitespace-nowrap transition-colors hover:text-[#8a2030]"
              style={{ color: i === active ? FG_LIGHT : MUTED_L, ...sans }}>
              {p.label}
              <span className="absolute left-4 right-4 bottom-0 h-[2px]" style={{ background: GOLD, opacity: i === active ? 1 : 0 }} />
            </button>
          ))}
        </div>
      )}
      <div className={`grid grid-cols-1 ${plan.image ? "md:grid-cols-[1.4fr_1fr]" : ""}`}>
        {plan.image && (
          <div className="p-5 flex items-center justify-center" style={{ background: CREAM }}>
            <img src={plan.image} alt={`${plan.label} floor plan`} className="w-full h-auto max-h-[420px] object-contain" />
          </div>
        )}
        <div className="p-6">
          {plans.length === 1 && <p className="text-[10px] tracking-[0.28em] uppercase mb-4" style={{ color: GOLD, ...sans }}>{plan.label}</p>}
          {plan.rooms.length === 0 ? (
            <p className="text-[14px]" style={{ color: MUTED_L, ...sans }}>Room details on request.</p>
          ) : (
            <ul className="flex flex-col">
              {plan.rooms.map((r, i) => (
                <li key={i} className="flex items-baseline justify-between gap-4 py-3 border-b last:border-b-0" style={{ borderColor: BORDER_L }}>
                  <span className="text-[14px]" style={{ color: FG_LIGHT, ...sans }}>{r.name}</span>
                  <span className="text-[13px] tabular-nums" style={{ color: MUTED_L, ...sans }}>{r.dims || "—"}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
