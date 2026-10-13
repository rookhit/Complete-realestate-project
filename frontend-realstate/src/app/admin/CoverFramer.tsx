import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Minus, Move, Plus, RotateCcw } from "lucide-react";
import type { Prop } from "@/app/data/properties";
import { BORDER_L, FG_LIGHT, GOLD, MUTED_L, WHITE, sans, serif } from "@/app/components/ui/brand";
import { Button } from "@/app/components/ui/form-controls";
import { ListingCard } from "@/app/components/ui/property-cards";
import { CENTRED, MAX_ZOOM, coverStyle, type Framing } from "@/app/components/ui/cover-frame";

/**
 * "Adjust thumbnail": the admin drags the cover photo inside a card-shaped frame and zooms, to
 * choose what shows where the cover is cropped (cards, home banner, map card). Live previews show
 * the real listing card and the home banner on desktop and on a phone. Nothing is uploaded and the
 * photo isn't changed: Apply returns a focal point + zoom (null when back to centred), which the
 * property saves as coverFrame.
 */
export function CoverFramer({ open, src, frame, prop, onApply, onClose }: {
  open: boolean; src: string; frame: Framing | undefined; prop: Prop;
  onApply: (frame: Framing | null) => void; onClose: () => void;
}) {
  const [f, setF] = useState<Framing>(frame ?? CENTRED);
  const [dragging, setDragging] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const img = useRef<HTMLImageElement>(null);
  const drag = useRef<{ x: number; y: number; start: Framing } | null>(null);

  // Start from the saved framing each time it opens.
  useEffect(() => { if (open) setF(frame ?? CENTRED); }, [open, frame]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: globalThis.KeyboardEvent) => { if (e.key === "Escape") { e.stopPropagation(); onClose(); } };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open, onClose]);

  const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
  const round = (n: number) => Math.round(n * 100) / 100;

  /**
   * How far the photo can move inside the frame, in pixels, along each axis. object-fit: cover
   * scales the photo to fill the frame; zoom enlarges it further. Moving the focal point by 1%
   * moves the photo by (zoomed size − frame size) / 100 pixels, so dividing a drag by that keeps
   * the photo under the pointer.
   */
  const slack = (zoom: number) => {
    const b = box.current?.getBoundingClientRect(), i = img.current;
    if (!b || !i || !i.naturalWidth) return { x: 0, y: 0 };
    const cover = Math.max(b.width / i.naturalWidth, b.height / i.naturalHeight);
    return { x: i.naturalWidth * cover * zoom - b.width, y: i.naturalHeight * cover * zoom - b.height };
  };

  const onDown = (e: PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, start: f };
    setDragging(true);
  };
  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    const s = slack(d.start.zoom);
    setF({
      ...d.start,
      x: s.x > 1 ? round(clamp(d.start.x - ((e.clientX - d.x) / s.x) * 100, 0, 100)) : d.start.x,
      y: s.y > 1 ? round(clamp(d.start.y - ((e.clientY - d.y) / s.y) * 100, 0, 100)) : d.start.y,
    });
  };
  const onUp = () => { drag.current = null; setDragging(false); };

  const zoomTo = (z: number) => setF(o => ({ ...o, zoom: round(clamp(z, 1, MAX_ZOOM)) }));
  // Arrow keys nudge the photo the way it would move under a finger; Shift moves further.
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = e.shiftKey ? 10 : 2;
    const moves: Record<string, [number, number]> = { ArrowLeft: [step, 0], ArrowRight: [-step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] };
    if (moves[e.key]) {
      e.preventDefault();
      const [dx, dy] = moves[e.key];
      setF(o => ({ ...o, x: clamp(o.x + dx, 0, 100), y: clamp(o.y + dy, 0, 100) }));
    } else if (e.key === "+" || e.key === "=") { e.preventDefault(); zoomTo(f.zoom + 0.1); }
    else if (e.key === "-") { e.preventDefault(); zoomTo(f.zoom - 0.1); }
  };

  const centred = f.x === CENTRED.x && f.y === CENTRED.y && f.zoom === CENTRED.zoom;
  const previewProp: Prop = { ...prop, hero: src, coverFrame: { src, ...f } };
  const banner = (aspect: string, label: string, width: string) => (
    <div className="flex flex-col gap-1.5" style={{ width }}>
      <div className="relative overflow-hidden" style={{ aspectRatio: aspect, background: "#1a1611" }}>
        <img src={src} alt="" className="w-full h-full object-cover" style={coverStyle(f)} />
        <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(10,9,8,0.85) 0%, rgba(10,9,8,0.1) 60%)" }} />
        <p className="absolute left-2 right-2 bottom-2 text-[11px] leading-tight truncate" style={{ color: WHITE, ...serif }}>{prop.title || "Property title"}</p>
      </div>
      <span className="text-[10px] tracking-[0.18em] uppercase" style={{ color: MUTED_L, ...sans }}>{label}</span>
    </div>
  );

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-[85] flex items-stretch sm:items-center justify-center sm:p-5"
          style={{ background: "rgba(10,9,8,0.62)", backdropFilter: "blur(4px)" }}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
          <motion.div role="dialog" aria-modal="true" aria-label="Adjust the thumbnail"
            className="w-full sm:max-w-5xl max-h-full overflow-y-auto border p-5 sm:p-8" style={{ background: WHITE, borderColor: BORDER_L }}
            initial={{ opacity: 0, y: 16, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }} onClick={e => e.stopPropagation()}>
            <h3 className="text-2xl mb-1.5" style={{ color: FG_LIGHT, ...serif }}>Adjust the thumbnail</h3>
            <p className="text-[14px] leading-relaxed mb-6" style={{ color: MUTED_L, ...sans }}>
              Drag the photo to choose what shows on property cards and the home page banner, and zoom in if needed. The full photo still shows on the property page.
            </p>

            <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_17rem] gap-7">
              {/* The frame: the same 4:3 shape as the listing cards. */}
              <div className="flex flex-col gap-4 min-w-0">
                <div ref={box} role="application" tabIndex={0}
                  aria-label="Photo position. Drag, or use the arrow keys to move and + or − to zoom."
                  aria-roledescription="draggable photo"
                  onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} onKeyDown={onKey}
                  className="relative overflow-hidden select-none outline-none focus-visible:ring-2 focus-visible:ring-[#8a2030]"
                  style={{ aspectRatio: "4/3", background: "#e9e3d8", cursor: dragging ? "grabbing" : "grab", touchAction: "none" }}>
                  <img ref={img} src={src} alt="" draggable={false} className="w-full h-full object-cover pointer-events-none" style={coverStyle(f)} />
                  {/* Rule-of-thirds guide while dragging. */}
                  <div className="absolute inset-0 pointer-events-none transition-opacity duration-200" style={{
                    opacity: dragging ? 1 : 0,
                    backgroundImage: "linear-gradient(to right, rgba(255,255,255,0.55) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.55) 1px, transparent 1px)",
                    backgroundSize: "33.333% 33.333%", backgroundPosition: "-1px -1px",
                  }} />
                  {!dragging && (
                    <span className="absolute left-1/2 bottom-3 -translate-x-1/2 flex items-center gap-1.5 px-3 py-1.5 text-[10px] tracking-[0.2em] uppercase pointer-events-none"
                      style={{ background: "rgba(10,9,8,0.6)", color: WHITE, ...sans }}><Move size={12} />Drag to move</span>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <button type="button" aria-label="Zoom out" onClick={() => zoomTo(f.zoom - 0.1)} disabled={f.zoom <= 1}
                    className="w-9 h-9 flex items-center justify-center border transition-colors hover:border-[#8a2030] disabled:opacity-30" style={{ borderColor: BORDER_L, color: FG_LIGHT }}><Minus size={14} /></button>
                  <input type="range" min={1} max={MAX_ZOOM} step={0.01} value={f.zoom} onChange={e => zoomTo(Number(e.target.value))}
                    aria-label="Zoom" className="flex-1 accent-[#8a2030]" />
                  <button type="button" aria-label="Zoom in" onClick={() => zoomTo(f.zoom + 0.1)} disabled={f.zoom >= MAX_ZOOM}
                    className="w-9 h-9 flex items-center justify-center border transition-colors hover:border-[#8a2030] disabled:opacity-30" style={{ borderColor: BORDER_L, color: FG_LIGHT }}><Plus size={14} /></button>
                  <span className="w-12 text-right text-[13px] tabular-nums" style={{ color: MUTED_L, ...sans }}>{f.zoom.toFixed(1)}×</span>
                </div>
              </div>

              {/* What visitors will see. */}
              <div className="flex flex-col gap-5">
                <div>
                  <p className="text-[10px] tracking-[0.25em] uppercase mb-2.5" style={{ color: GOLD, ...sans }}>Property card</p>
                  <div className="pointer-events-none"><ListingCard p={previewProp} light /></div>
                </div>
                <div>
                  <p className="text-[10px] tracking-[0.25em] uppercase mb-2.5" style={{ color: GOLD, ...sans }}>Home page banner</p>
                  <div className="flex items-end gap-3">
                    {banner("16 / 9", "Desktop", "68%")}
                    {banner("9 / 16", "Phone", "24%")}
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-7 pt-6 border-t flex flex-col-reverse sm:flex-row sm:items-center gap-3" style={{ borderColor: BORDER_L }}>
              <button type="button" onClick={() => setF(CENTRED)} disabled={centred}
                className="sm:mr-auto self-start flex items-center gap-2 text-[11px] tracking-[0.2em] uppercase underline underline-offset-4 transition-colors hover:text-[#8a2030] disabled:opacity-30 disabled:no-underline"
                style={{ color: MUTED_L, ...sans }}><RotateCcw size={13} />Reset to centre</button>
              <Button variant="quiet" onClick={onClose}>Cancel</Button>
              <Button onClick={() => { onApply(centred ? null : f); onClose(); }}>Apply</Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
