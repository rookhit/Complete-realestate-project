import { useState, type CSSProperties, type ReactNode } from "react";
import { planArea, type PlanBox } from "@/app/data/properties";
import { BORDER_L, CREAM, FG_LIGHT, GOLD, MAROON, MUTED_L, WHITE, sans, serif } from "./brand";

/** The drawing surface shared by the viewer and the admin's builder: a fine blueprint grid. */
export const PLAN_SURFACE: CSSProperties = {
  aspectRatio: "16 / 10",
  background: `${CREAM} linear-gradient(rgba(26,22,17,0.05) 1px, transparent 1px) 0 0 / 5% 8%, ${CREAM} linear-gradient(90deg, rgba(26,22,17,0.05) 1px, transparent 1px) 0 0 / 5% 8%`,
  backgroundColor: CREAM,
};

/** Where a box sits on the plan. */
export const boxPosition = (b: PlanBox): CSSProperties => ({ left: `${b.x}%`, top: `${b.y}%`, width: `${b.w}%`, height: `${b.h}%` });

/**
 * A box's name and area, printed inside it. `always` keeps the area visible (phones, and
 * the admin); otherwise it appears on hover.
 */
export function BoxLabel({ b, on, always = false }: { b: PlanBox; on: boolean; always?: boolean }) {
  return (
    <span className="absolute inset-0 flex flex-col items-center justify-center gap-0.5 p-1.5 text-center pointer-events-none overflow-hidden">
      <span className="leading-tight text-[11px] sm:text-[13px] md:text-[14px] line-clamp-2" style={{ color: on ? MAROON : FG_LIGHT, ...serif }}>{b.name || "Untitled"}</span>
      <span className={`text-[10px] sm:text-[11px] tracking-[0.06em] tabular-nums transition-opacity ${always ? "" : "md:opacity-0"} ${on ? "md:opacity-100" : ""}`}
        style={{ color: on ? MAROON : MUTED_L, ...sans }}>{b.area > 0 ? planArea(b.area) : "— sq.ft"}</span>
    </span>
  );
}

/**
 * The floor plan on the property page. Desktop: hover a box for its name and area.
 * Phones can't hover, so the area is printed in every box and listed underneath.
 */
export function FloorPlanViewer({ boxes, footer }: { boxes: PlanBox[]; footer?: ReactNode }) {
  const [active, setActive] = useState<string | null>(null);
  const total = boxes.reduce((n, b) => n + (b.area || 0), 0);
  const current = boxes.find(b => b.id === active);
  return (
    <div className="border" style={{ borderColor: BORDER_L, background: WHITE }}>
      <div className="p-3 sm:p-5">
        <div className="relative w-full border" style={{ ...PLAN_SURFACE, borderColor: "rgba(26,22,17,0.18)" }} onMouseLeave={() => setActive(null)}>
          {boxes.map(b => {
            const on = b.id === active;
            return (
              <button key={b.id} type="button" aria-label={`${b.name}, ${planArea(b.area)}`}
                onMouseEnter={() => setActive(b.id)} onFocus={() => setActive(b.id)} onClick={() => setActive(on ? null : b.id)}
                className="absolute transition-colors duration-200 outline-none"
                style={{ ...boxPosition(b), border: `1.5px solid ${on ? MAROON : "rgba(26,22,17,0.55)"}`, background: on ? "rgba(138,32,48,0.08)" : "rgba(255,255,255,0.72)", zIndex: on ? 2 : 1 }}>
                <BoxLabel b={b} on={on} />
              </button>
            );
          })}
          {/* Hover card, desktop only: phones already show everything in the boxes. */}
          {current && (
            <div className="hidden md:block absolute z-10 pointer-events-none px-4 py-3 shadow-xl -translate-x-1/2 -translate-y-full"
              style={{ left: `${current.x + current.w / 2}%`, top: `calc(${current.y}% - 8px)`, background: "#1a1611", minWidth: 150 }}>
              <p className="text-[15px] leading-tight whitespace-nowrap" style={{ color: WHITE, ...serif }}>{current.name}</p>
              <p className="mt-1 text-[12px] tracking-[0.08em]" style={{ color: GOLD, ...sans }}>{planArea(current.area)}</p>
            </div>
          )}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 px-4 sm:px-5 py-3.5 border-t" style={{ borderColor: BORDER_L }}>
        {boxes.map(b => (
          <button key={b.id} type="button" onMouseEnter={() => setActive(b.id)} onMouseLeave={() => setActive(null)} onClick={() => setActive(b.id === active ? null : b.id)}
            className="flex items-center gap-2 text-[12px] transition-colors" style={{ color: b.id === active ? MAROON : MUTED_L, ...sans }}>
            <span className="w-2.5 h-2.5 border" style={{ borderColor: b.id === active ? MAROON : "rgba(26,22,17,0.55)" }} />
            {b.name} <span className="tabular-nums" style={{ color: FG_LIGHT }}>{planArea(b.area)}</span>
          </button>
        ))}
        {boxes.length > 1 && total > 0 && (
          <span className="ml-auto text-[11px] tracking-[0.18em] uppercase" style={{ color: FG_LIGHT, ...sans }}>Total {planArea(total)}</span>
        )}
        {footer}
      </div>
    </div>
  );
}
