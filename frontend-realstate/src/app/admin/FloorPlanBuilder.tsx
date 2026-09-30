import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { Check, Eye, Move, Pencil, Trash2 } from "lucide-react";
import { FLOOR_NAMES, PLAN_BOX_SIZES, planArea, type PlanBox } from "@/app/data/properties";
import { BORDER_L, FG_LIGHT, GOLD, MAROON, MUTED_L, WHITE, sans } from "@/app/components/ui/brand";
import { BoxLabel, FloorPlanViewer, PLAN_SURFACE, boxPosition } from "@/app/components/ui/floor-plan";

type SizeKey = (typeof PLAN_BOX_SIZES)[number]["key"];
const DRAG_TYPE = "application/x-nb-plan-size";
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const fit = (b: PlanBox): PlanBox => {
  const w = clamp(Math.round(b.w), 8, 100), h = clamp(Math.round(b.h), 8, 100);
  return { ...b, w, h, x: clamp(Math.round(b.x), 0, 100 - w), y: clamp(Math.round(b.y), 0, 100 - h) };
};
const overlaps = (a: PlanBox, b: PlanBox) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const inputCls = "w-full border px-3 py-2.5 text-[14px] outline-none transition-colors focus:border-[#8a2030]";

/**
 * The admin's floor-plan builder. Drag a box size onto the plan (or click it on touch
 * screens); a small card opens right beside the box to name it and enter its area, so the
 * admin never scrolls away from the plan. Drag boxes to move them, the corner to resize.
 */
export function FloorPlanBuilder({ boxes, onChange }: { boxes: PlanBox[]; onChange: (v: PlanBox[]) => void }) {
  const canvas = useRef<HTMLDivElement>(null);
  const nameInput = useRef<HTMLInputElement>(null);
  const latest = useRef(boxes);
  latest.current = boxes;
  const [sel, setSel] = useState<string | null>(null);
  const [focusName, setFocusName] = useState(0);
  const [over, setOver] = useState(false);
  const [preview, setPreview] = useState(false);
  // On a narrow plan (phones) the editing card goes under the plan instead of beside the box.
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const el = canvas.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setNarrow(el.clientWidth < 520));
    ro.observe(el);
    return () => ro.disconnect();
  }, [preview]);
  const drag = useRef<{ id: string; mode: "move" | "resize"; sx: number; sy: number; start: PlanBox; moved: boolean } | null>(null);
  const selected = boxes.find(b => b.id === sel) ?? null;

  // A new box: put the cursor in its name without scrolling the page.
  useEffect(() => { if (focusName) { nameInput.current?.focus({ preventScroll: !narrow }); nameInput.current?.select(); } }, [focusName]);

  const update = (id: string, patch: Partial<PlanBox>) => onChange(latest.current.map(b => (b.id === id ? fit({ ...b, ...patch }) : b)));
  const remove = (id: string) => { onChange(latest.current.filter(b => b.id !== id)); setSel(null); };

  /** A new box of this size, centred on `at` (a drop point) or in the first free spot. */
  const add = (key: SizeKey, at?: { x: number; y: number }) => {
    const size = PLAN_BOX_SIZES.find(s => s.key === key)!;
    const name = FLOOR_NAMES.find(n => !latest.current.some(b => b.name === n)) ?? `Floor ${latest.current.length + 1}`;
    const base = { id: `b${Date.now().toString(36)}`, name, area: 0, w: size.w, h: size.h };
    let box = fit({ ...base, x: at ? at.x - size.w / 2 : 4, y: at ? at.y - size.h / 2 : 4 });
    if (!at) {
      outer: for (let y = 4; y <= 100 - size.h; y += 4) for (let x = 4; x <= 100 - size.w; x += 4) {
        const test = fit({ ...base, x, y });
        if (!latest.current.some(b => overlaps(b, test))) { box = test; break outer; }
      }
    }
    onChange([...latest.current, box]);
    setPreview(false); setSel(box.id); setFocusName(n => n + 1);
  };

  const startDrag = (e: ReactPointerEvent, b: PlanBox, mode: "move" | "resize") => {
    e.preventDefault(); e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setSel(b.id);
    drag.current = { id: b.id, mode, sx: e.clientX, sy: e.clientY, start: b, moved: false };
  };
  const onMove = (e: ReactPointerEvent) => {
    const d = drag.current;
    if (!d || !canvas.current) return;
    const r = canvas.current.getBoundingClientRect();
    const dx = ((e.clientX - d.sx) / r.width) * 100, dy = ((e.clientY - d.sy) / r.height) * 100;
    if (Math.abs(dx) + Math.abs(dy) > 0.5) d.moved = true;
    update(d.id, d.mode === "move" ? { x: d.start.x + dx, y: d.start.y + dy } : { w: d.start.w + dx, h: d.start.h + dy });
  };
  const endDrag = () => { drag.current = null; };

  // The editing card opens beside the box (right, or left near the right edge), kept inside
  // the plan's height so it never lands below the fold. Very wide boxes get it above or below.
  const cardPos = (b: PlanBox): React.CSSProperties => {
    const top = `${Math.min(b.y, 40)}%`;
    if (b.x + b.w <= 64) return { top, left: `calc(${b.x + b.w}% + 10px)` };
    if (b.x >= 36) return { top, right: `calc(${100 - b.x}% + 10px)` };
    return { ...(b.y + b.h > 62 ? { bottom: `calc(${100 - b.y}% + 10px)` } : { top: `calc(${b.y + b.h}% + 10px)` }), left: `${b.x}%` };
  };
  const unusedNames = FLOOR_NAMES.filter(n => !boxes.some(b => b.name === n));

  const editCard = selected && (
    <div key={selected.id} role="dialog" aria-label={`Edit ${selected.name}`}
      className={`${narrow ? "relative w-full" : "absolute z-20 w-[300px] shadow-2xl"} border p-4 flex flex-col gap-3 cursor-auto`}
      style={{ ...(narrow ? {} : cardPos(selected)), background: WHITE, borderColor: "rgba(138,32,48,0.35)" }}
      onPointerDown={e => e.stopPropagation()}
      onKeyDown={e => { if (e.key === "Escape") { e.stopPropagation(); setSel(null); } }}>
      <div className="grid grid-cols-[1fr_6.5rem] gap-2">
        <label className="flex flex-col gap-1">
          <span className="text-[9.5px] tracking-[0.24em] uppercase" style={{ color: MUTED_L, ...sans }}>Floor name</span>
          <input ref={nameInput} value={selected.name} maxLength={30} placeholder="e.g. 1st Floor"
            onChange={e => update(selected.id, { name: e.target.value })} className={inputCls} style={{ borderColor: BORDER_L, color: FG_LIGHT, ...sans }} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[9.5px] tracking-[0.24em] uppercase" style={{ color: MUTED_L, ...sans }}>Area sq.ft</span>
          <input value={selected.area ? String(selected.area) : ""} inputMode="numeric" placeholder="300"
            onChange={e => update(selected.id, { area: Number(e.target.value.replace(/\D/g, "").slice(0, 6)) || 0 })}
            onKeyDown={e => { if (e.key === "Enter") setSel(null); }}
            className={inputCls} style={{ borderColor: selected.area ? BORDER_L : "rgba(138,32,48,0.45)", color: FG_LIGHT, ...sans }} />
        </label>
      </div>
      {unusedNames.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {unusedNames.slice(0, 5).map(n => (
            <button key={n} type="button" onClick={() => update(selected.id, { name: n })}
              className="px-2 py-1 border text-[11px] transition-colors hover:border-[#8a2030] hover:text-[#8a2030]" style={{ borderColor: BORDER_L, color: MUTED_L, ...sans }}>{n}</button>
          ))}
        </div>
      )}
      <div className="flex items-center gap-1.5">
        {PLAN_BOX_SIZES.map(s => {
          const is = selected.w === s.w && selected.h === s.h;
          return (
            <button key={s.key} type="button" onClick={() => update(selected.id, { w: s.w, h: s.h })} title={`${s.label} size`}
              className="w-8 h-8 border text-[11px] transition-colors hover:border-[#8a2030]" style={{ borderColor: is ? GOLD : BORDER_L, background: is ? "rgba(176,136,72,0.1)" : WHITE, color: FG_LIGHT, ...sans }}>{s.label[0]}</button>
          );
        })}
        <button type="button" onClick={() => remove(selected.id)} aria-label="Remove this box" title="Remove"
          className="w-8 h-8 flex items-center justify-center border transition-colors hover:border-[#8a2030] hover:text-[#8a2030]" style={{ borderColor: BORDER_L, color: MUTED_L }}><Trash2 size={14} /></button>
        <button type="button" onClick={() => setSel(null)}
          className="ml-auto inline-flex items-center gap-1.5 h-8 px-3 text-[10px] tracking-[0.2em] uppercase transition-all hover:brightness-110" style={{ background: MAROON, color: WHITE, ...sans }}>
          <Check size={13} />Done
        </button>
      </div>
      {selected.area > 0 && <p className="text-[11px]" style={{ color: MUTED_L, ...sans }}>Visitors see “{selected.name || "Untitled"} · {planArea(selected.area)}”</p>}
    </div>
  );

  return (
    <div className="flex flex-col gap-4">
      {/* Box sizes: drag onto the plan, or click to drop one in the next free spot. */}
      <div className="flex flex-wrap items-center gap-2.5">
        <span className="text-[10px] tracking-[0.28em] uppercase mr-1" style={{ color: GOLD, ...sans }}>Drag onto the plan</span>
        {PLAN_BOX_SIZES.map(s => (
          <button key={s.key} type="button" draggable onClick={() => add(s.key)} title={`${s.label} box: drag onto the plan, or click to add`}
            onDragStart={e => { e.dataTransfer.setData(DRAG_TYPE, s.key); e.dataTransfer.effectAllowed = "copy"; }}
            className="group flex items-center gap-2.5 pl-2.5 pr-3.5 py-2 border cursor-grab active:cursor-grabbing transition-colors hover:border-[#8a2030]"
            style={{ borderColor: BORDER_L, background: WHITE }}>
            <span className="flex items-center justify-center w-9 h-7">
              <span className="block border-[1.5px] transition-colors group-hover:border-[#8a2030]" style={{ width: s.w * 0.7, height: s.h * 0.5, borderColor: FG_LIGHT, background: "rgba(176,136,72,0.1)" }} />
            </span>
            <span className="text-[11px] tracking-[0.12em] uppercase" style={{ color: FG_LIGHT, ...sans }}>{s.label}</span>
          </button>
        ))}
        {boxes.length > 0 && (
          <button type="button" onClick={() => { setPreview(p => !p); setSel(null); }} aria-pressed={preview}
            className="ml-auto inline-flex items-center gap-2 px-3.5 py-2 border text-[11px] tracking-[0.14em] uppercase transition-colors hover:border-[#8a2030]"
            style={{ borderColor: preview ? GOLD : BORDER_L, background: preview ? "rgba(176,136,72,0.1)" : WHITE, color: FG_LIGHT, ...sans }}>
            {preview ? <><Pencil size={13} />Back to editing</> : <><Eye size={13} />Preview as visitor</>}
          </button>
        )}
      </div>

      {preview ? <FloorPlanViewer boxes={boxes} /> : (
        <div ref={canvas} role="region" aria-label="Floor plan: drop boxes here" className="relative w-full border-2 border-dashed transition-colors select-none"
          style={{ ...PLAN_SURFACE, borderColor: over ? MAROON : "rgba(26,22,17,0.2)", touchAction: "none" }}
          onPointerMove={onMove} onPointerUp={endDrag} onPointerCancel={endDrag}
          onPointerDown={() => setSel(null)}
          onDragOver={e => { if (e.dataTransfer.types.includes(DRAG_TYPE)) { e.preventDefault(); e.dataTransfer.dropEffect = "copy"; setOver(true); } }}
          onDragLeave={() => setOver(false)}
          onDrop={e => {
            const key = e.dataTransfer.getData(DRAG_TYPE) as SizeKey;
            setOver(false);
            if (!key || !canvas.current) return;
            e.preventDefault();
            const r = canvas.current.getBoundingClientRect();
            add(key, { x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 });
          }}>
          {boxes.length === 0 && (
            <p className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-center px-6 pointer-events-none text-[13px]" style={{ color: MUTED_L, ...sans }}>
              <Move size={20} style={{ color: GOLD }} />Drag a Small, Medium or Large box here, or click one above.<br />Then type its floor name and area right beside it.
            </p>
          )}
          {boxes.map(b => {
            const on = b.id === sel;
            return (
              <div key={b.id} role="button" tabIndex={0} aria-label={`${b.name}: drag to move, click to edit`}
                onPointerDown={e => startDrag(e, b, "move")}
                onKeyDown={e => {
                  const step = e.shiftKey ? 5 : 1;
                  const moves: Record<string, Partial<PlanBox>> = { ArrowLeft: { x: b.x - step }, ArrowRight: { x: b.x + step }, ArrowUp: { y: b.y - step }, ArrowDown: { y: b.y + step } };
                  if (moves[e.key]) { e.preventDefault(); update(b.id, moves[e.key]); }
                  if (e.key === "Delete") { e.preventDefault(); remove(b.id); }
                  if (e.key === "Enter") { e.preventDefault(); setSel(b.id); setFocusName(n => n + 1); }
                }}
                onFocus={() => setSel(b.id)}
                className="absolute cursor-move outline-none"
                style={{ ...boxPosition(b), border: `1.5px solid ${on ? MAROON : "rgba(26,22,17,0.6)"}`, background: on ? "rgba(138,32,48,0.07)" : "rgba(255,255,255,0.8)", boxShadow: on ? "0 8px 24px rgba(138,32,48,0.15)" : "none", zIndex: on ? 3 : 1 }}>
                <BoxLabel b={b} on={on} always />
                {on && (
                  <span onPointerDown={e => startDrag(e, b, "resize")} aria-hidden title="Drag to resize"
                    className="absolute -right-1.5 -bottom-1.5 w-3.5 h-3.5 cursor-nwse-resize" style={{ background: MAROON, border: `2px solid ${WHITE}` }} />
                )}
              </div>
            );
          })}

          {!narrow && editCard}
        </div>
      )}
      {!preview && narrow && editCard}

      {!preview && boxes.length > 0 && (
        <p className="text-[12px]" style={{ color: MUTED_L, ...sans }}>
          Click a box to edit it · drag to move · drag its corner to resize · arrow keys nudge.{" "}
          {boxes.some(b => !b.area) && <span style={{ color: MAROON }}>{boxes.filter(b => !b.area).length} box{boxes.filter(b => !b.area).length === 1 ? " needs its" : "es need their"} area.</span>}
          {boxes.length > 0 && <button type="button" onClick={() => { onChange([]); setSel(null); }} className="ml-3 underline underline-offset-4 hover:text-[#8a2030]">Clear plan</button>}
        </p>
      )}
    </div>
  );
}
