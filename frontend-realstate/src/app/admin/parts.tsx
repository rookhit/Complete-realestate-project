import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { motion, AnimatePresence } from "motion/react";
import { CheckCircle2, Eye, Search, X } from "lucide-react";
import { BG_LIGHT, BORDER_L, FG_LIGHT, GOLD, MUTED_L, WHITE, sans, serif } from "@/app/components/ui/brand";
import { BackButton } from "@/app/components/ui/back-button";
import { ConfirmDialog } from "@/app/components/ui/confirm-dialog";
import { Button } from "@/app/components/ui/form-controls";

// Shared admin pieces: the editor drawer, toasts, headings, search box, empty state.

// Slide-in editor panel.
//   preview - live preview beside the form (wide screens), shrunk to fit so it is seen
//             whole without scrolling; behind a Preview button on smaller screens
//   dirty   - ask before closing with unsaved changes
//   onSave  - also bound to Ctrl+S
export function Drawer({ open, onClose, backLabel, title, subtitle, footer, width = 880, children, preview, previewTitle = "How it will look", dirty = false, onSave, headerExtra }: {
  open: boolean; onClose: () => void; backLabel: string; title: string; subtitle?: string;
  footer: ReactNode; width?: number; children: ReactNode;
  preview?: ReactNode; previewTitle?: string; dirty?: boolean; onSave?: () => void; headerExtra?: ReactNode;
}) {
  const [askDiscard, setAskDiscard] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const requestClose = useCallback(() => { if (dirty) setAskDiscard(true); else onClose(); }, [dirty, onClose]);
  // Latest handlers for the keyboard listener, without re-binding it on every keystroke.
  const keys = useRef({ requestClose, onSave, previewOpen, askDiscard });
  keys.current = { requestClose, onSave, previewOpen, askDiscard };

  useEffect(() => {
    if (!open) { setAskDiscard(false); setPreviewOpen(false); return; }
    const onKey = (e: KeyboardEvent) => {
      const k = keys.current;
      if (e.key === "Escape") {
        if (k.askDiscard) setAskDiscard(false);
        else if (k.previewOpen) setPreviewOpen(false);
        else k.requestClose();
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s" && k.onSave) { e.preventDefault(); k.onSave(); }
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [open]);

  const maxWidth = preview ? Math.max(width, 1260) : width;

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-[70] flex justify-end" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="absolute inset-0" style={{ background: "rgba(10,9,8,0.55)", backdropFilter: "blur(3px)" }} onClick={requestClose} />
          <motion.aside role="dialog" aria-modal="true" aria-label={title}
            // Phones: the whole panel scrolls as one page (header included) with the buttons pinned
            // at the bottom. Wider screens: fixed header and footer, the form scrolls between them.
            className="relative h-full w-full flex flex-col shadow-2xl overflow-y-auto overscroll-contain sm:overflow-hidden" style={{ maxWidth, background: BG_LIGHT }}
            initial={{ x: 60, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 60, opacity: 0 }}
            transition={{ duration: 0.34, ease: [0.16, 1, 0.3, 1] }}>
            <header className="shrink-0 px-5 sm:px-6 md:px-10 pt-4 sm:pt-6 pb-4 sm:pb-5 border-b" style={{ background: WHITE, borderColor: BORDER_L }}>
              <div className="flex items-center justify-between gap-4 mb-3 sm:mb-5">
                <BackButton label={backLabel} onClick={requestClose} />
                <button type="button" onClick={requestClose} aria-label="Close" className="p-2 transition-colors hover:text-[#8a2030]" style={{ color: MUTED_L }}><X size={18} /></button>
              </div>
              <h2 className="leading-tight" style={{ color: FG_LIGHT, ...serif, fontSize: "clamp(1.6rem,3vw,2.2rem)" }}>{title}</h2>
              {subtitle && <p className="mt-1.5 text-[13px] sm:text-[14px]" style={{ color: MUTED_L, ...sans }}>{subtitle}</p>}
              {headerExtra && <div className="mt-4 sm:mt-5">{headerExtra}</div>}
            </header>

            {/* Form and preview scroll separately, so a long preview is never cut off. */}
            <div className="flex-none sm:flex-1 sm:min-h-0 flex">
              <div className="flex-1 min-w-0 sm:overflow-y-auto">
                <div className="px-4 sm:px-6 md:px-10 py-6 sm:py-8">{children}</div>
              </div>
              {preview && (
                <aside className="hidden xl:flex flex-col w-[420px] shrink-0 border-l" style={{ borderColor: BORDER_L, background: "#efe9df" }} aria-label="Live preview">
                  <div className="shrink-0 px-8 pt-6 pb-4 border-b" style={{ borderColor: BORDER_L }}><PreviewHeading title={previewTitle} /></div>
                  <div className="flex-1 min-h-0 px-8 py-6"><FitToHeight>{preview}</FitToHeight></div>
                </aside>
              )}
            </div>

            {/* Phones: buttons two to a row, smaller type, so the form keeps most of the screen. */}
            <footer className="sticky bottom-0 z-10 mt-auto shrink-0 px-4 sm:px-6 md:px-10 py-3 sm:py-4 border-t flex flex-wrap items-center gap-2 sm:gap-3 sm:justify-end
              [&>button]:basis-[calc(50%-4px)] sm:[&>button]:basis-auto [&>button]:px-3 sm:[&>button]:px-6 [&>button]:py-3 sm:[&>button]:py-3.5 [&>button]:tracking-[0.14em] sm:[&>button]:tracking-[0.24em]
              [&>p]:basis-full sm:[&>p]:basis-auto" style={{ background: WHITE, borderColor: BORDER_L, boxShadow: "0 -8px 20px -16px rgba(26,22,17,0.35)" }}>
              {preview && (
                <button type="button" onClick={() => setPreviewOpen(true)}
                  className="xl:hidden sm:mr-auto inline-flex items-center justify-center gap-2 px-5 py-3.5 text-[11px] tracking-[0.24em] uppercase border transition-colors hover:border-[#8a2030]"
                  style={{ borderColor: "rgba(176,136,72,0.55)", color: FG_LIGHT, background: "rgba(176,136,72,0.07)", ...sans }}>
                  <Eye size={14} style={{ color: GOLD }} />Preview
                </button>
              )}
              <Button variant="quiet" onClick={requestClose}>Cancel</Button>
              {footer}
            </footer>
          </motion.aside>

          {/* Preview pop-up */}
          <AnimatePresence>
            {previewOpen && preview && (
              <motion.div className="fixed inset-0 z-[78] flex items-stretch sm:items-center justify-center sm:p-5" style={{ background: "rgba(10,9,8,0.7)", backdropFilter: "blur(4px)" }}
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setPreviewOpen(false)}>
                <motion.div role="dialog" aria-modal="true" aria-label={previewTitle} className="w-full sm:max-w-lg h-full sm:h-auto sm:max-h-[90vh] flex flex-col" style={{ background: "#efe9df" }}
                  initial={{ y: 18, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 12, opacity: 0 }} transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
                  onClick={e => e.stopPropagation()}>
                  <div className="shrink-0 flex items-center justify-between gap-3 pl-6 pr-3 py-3 border-b" style={{ borderColor: BORDER_L, background: WHITE }}>
                    <PreviewHeading title={previewTitle} />
                    <button type="button" onClick={() => setPreviewOpen(false)} className="inline-flex items-center gap-1.5 px-3 py-2 text-[11px] tracking-[0.2em] uppercase transition-colors hover:text-[#8a2030]" style={{ color: FG_LIGHT, ...sans }}>
                      Back to editing <X size={15} />
                    </button>
                  </div>
                  <div className="flex-1 overflow-y-auto overscroll-contain p-6">{preview}</div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          <ConfirmDialog open={askDiscard} title="Discard your changes?" message="You have edits that haven’t been saved. Leave without saving them?"
            confirmLabel="Discard" onCancel={() => setAskDiscard(false)} onConfirm={() => { setAskDiscard(false); onClose(); }} />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/**
 * Shows its content whole: when it is taller than the space, it is scaled down to fit.
 * Below `min` it stops shrinking (the text would be unreadable) and scrolls instead.
 */
function FitToHeight({ children, min = 0.6 }: { children: ReactNode; min?: number }) {
  const box = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState({ scale: 1, height: 0 });
  useLayoutEffect(() => {
    const b = box.current, i = inner.current;
    if (!b || !i) return;
    const measure = () => {
      const natural = i.offsetHeight, room = b.clientHeight;   // offsetHeight ignores the transform
      const scale = natural > room && room > 0 ? Math.max(min, room / natural) : 1;
      setFit(f => (f.scale === scale && f.height === natural * scale ? f : { scale, height: natural * scale }));
    };
    const ro = new ResizeObserver(measure);
    ro.observe(b); ro.observe(i); measure();
    return () => ro.disconnect();
  }, [min]);
  return (
    <div ref={box} className={`h-full ${fit.scale <= min ? "overflow-y-auto overscroll-contain" : "overflow-hidden"}`}>
      <div style={{ height: fit.height || undefined }}>
        <div ref={inner} style={{ transform: `scale(${fit.scale})`, transformOrigin: "top center" }}>{children}</div>
      </div>
    </div>
  );
}

function PreviewHeading({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="relative flex w-2 h-2">
        <span className="absolute inline-flex w-full h-full rounded-full opacity-60 animate-ping" style={{ background: GOLD }} />
        <span className="relative inline-flex w-2 h-2 rounded-full" style={{ background: GOLD }} />
      </span>
      <span className="text-[10px] tracking-[0.3em] uppercase" style={{ color: FG_LIGHT, ...sans }}>{title}</span>
      <span className="hidden sm:inline text-[11px]" style={{ color: MUTED_L, ...sans }}>· updates as you type</span>
    </div>
  );
}

/** Optional button in a toast, e.g. { label: "Undo", run: restore }. */
export type ToastAction = { label: string; run: () => void };
export type Notify = (message: string, action?: ToastAction) => void;

/**
 * A short confirmation in the bottom-left corner: `show("Property saved")`.
 * With an action (usually Undo) it stays up longer so there's time to use it.
 */
export function useToast(): [ReactNode, Notify] {
  const [toast, setToast] = useState<{ msg: string; action?: ToastAction } | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const show = useCallback<Notify>((msg, action) => {
    setToast({ msg, action });
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setToast(null), action ? 7000 : 2800);
  }, []);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const node = (
    <AnimatePresence>
      {toast && (
        <motion.div role="status" className="fixed bottom-7 left-7 z-[90] flex items-center gap-3 pl-5 pr-3 py-3 shadow-xl"
          style={{ background: FG_LIGHT, color: WHITE, ...sans }}
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} transition={{ duration: 0.25 }}>
          <CheckCircle2 size={17} style={{ color: GOLD }} />
          <span className="text-[14px] py-1">{toast.msg}</span>
          {toast.action && (
            <button type="button" onClick={() => { toast.action!.run(); setToast(null); }}
              className="ml-2 px-3 py-1.5 text-[11px] tracking-[0.2em] uppercase transition-colors hover:bg-white/10"
              style={{ color: GOLD, border: "1px solid rgba(176,136,72,0.6)" }}>
              {toast.action.label}
            </button>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
  return [node, show];
}

/** The heading row of a dashboard section, with actions on the right. */
export function SectionHeading({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="flex flex-col md:flex-row md:items-end justify-between gap-5 mb-8">
      <div className="min-w-0">
        <h2 className="leading-tight" style={{ color: FG_LIGHT, ...serif, fontSize: "clamp(1.7rem,3vw,2.4rem)" }}>{title}</h2>
        {subtitle && <p className="mt-2 text-[14px] max-w-xl leading-relaxed" style={{ color: MUTED_L, ...sans }}>{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-3 shrink-0">{actions}</div>}
    </div>
  );
}

export function SearchBox({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div className="relative flex-1 min-w-[14rem]">
      <Search size={15} className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: MUTED_L }} />
      <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} aria-label={placeholder}
        className="w-full border pl-11 pr-10 py-3 text-[14px] outline-none transition-colors focus:border-[#8a2030]"
        style={{ borderColor: BORDER_L, background: WHITE, color: FG_LIGHT, ...sans }} />
      {value && (
        <button type="button" onClick={() => onChange("")} aria-label="Clear search"
          className="absolute right-3 top-1/2 -translate-y-1/2 p-1 transition-colors hover:text-[#8a2030]" style={{ color: MUTED_L }}>
          <X size={14} />
        </button>
      )}
    </div>
  );
}

export function EmptyState({ title, text, action }: { title: string; text: string; action?: ReactNode }) {
  return (
    <div className="border px-6 py-16 text-center flex flex-col items-center gap-3" style={{ borderColor: BORDER_L, background: WHITE }}>
      <p className="text-xl" style={{ color: FG_LIGHT, ...serif }}>{title}</p>
      <p className="text-[14px] max-w-sm" style={{ color: MUTED_L, ...sans }}>{text}</p>
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

/** A small uppercase chip, e.g. a badge or "For Rent". */
export function Chip({ children, tone = "gold" }: { children: ReactNode; tone?: "gold" | "maroon" | "dark" | "muted" }) {
  const styles = {
    gold: { background: "rgba(176,136,72,0.12)", color: GOLD },
    maroon: { background: "#8a2030", color: WHITE },
    dark: { background: FG_LIGHT, color: WHITE },
    muted: { background: "rgba(26,22,17,0.06)", color: MUTED_L },
  }[tone];
  return <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[9px] tracking-[0.2em] uppercase whitespace-nowrap" style={{ ...styles, ...sans }}>{children}</span>;
}
