import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { motion, AnimatePresence } from "motion/react";
import { CheckCircle2, Eye, Search, X } from "lucide-react";
import { BG_LIGHT, BORDER_L, FG_LIGHT, GOLD, MUTED_L, WHITE, sans, serif } from "@/app/components/ui/brand";
import { BackButton } from "@/app/components/ui/back-button";
import { ConfirmDialog } from "@/app/components/ui/confirm-dialog";
import { Button } from "@/app/components/ui/form-controls";

// Shared admin pieces: the editor drawer, toasts, headings, search box, empty state.

// Slide-in editor panel.
//   preview - live preview beside the form (wide screens) or behind a Preview button
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
            className="relative h-full w-full flex flex-col shadow-2xl" style={{ maxWidth, background: BG_LIGHT }}
            initial={{ x: 60, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 60, opacity: 0 }}
            transition={{ duration: 0.34, ease: [0.16, 1, 0.3, 1] }}>
            <header className="shrink-0 px-6 md:px-10 pt-6 pb-5 border-b" style={{ background: WHITE, borderColor: BORDER_L }}>
              <div className="flex items-center justify-between gap-4 mb-5">
                <BackButton label={backLabel} onClick={requestClose} />
                <button type="button" onClick={requestClose} aria-label="Close" className="p-2 transition-colors hover:text-[#8a2030]" style={{ color: MUTED_L }}><X size={18} /></button>
              </div>
              <h2 className="leading-tight" style={{ color: FG_LIGHT, ...serif, fontSize: "clamp(1.6rem,3vw,2.2rem)" }}>{title}</h2>
              {subtitle && <p className="mt-1.5 text-[14px]" style={{ color: MUTED_L, ...sans }}>{subtitle}</p>}
              {headerExtra && <div className="mt-5">{headerExtra}</div>}
            </header>

            <div className="flex-1 overflow-y-auto">
              <div className={preview ? "xl:grid xl:grid-cols-[minmax(0,1fr)_400px]" : ""}>
                <div className="px-6 md:px-10 py-8 min-w-0">{children}</div>
                {preview && (
                  <aside className="hidden xl:block border-l" style={{ borderColor: BORDER_L, background: "#efe9df" }} aria-label="Live preview">
                    <div className="sticky top-0 px-8 py-8">
                      <PreviewHeading title={previewTitle} />
                      {preview}
                    </div>
                  </aside>
                )}
              </div>
            </div>

            <footer className="shrink-0 px-6 md:px-10 py-4 border-t flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-3" style={{ background: WHITE, borderColor: BORDER_L }}>
              {preview && (
                <button type="button" onClick={() => setPreviewOpen(true)}
                  className="sm:mr-auto inline-flex items-center justify-center gap-2 px-5 py-3.5 text-[11px] tracking-[0.24em] uppercase border transition-colors hover:border-[#8a2030]"
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
              <motion.div className="fixed inset-0 z-[78] flex items-center justify-center p-5" style={{ background: "rgba(10,9,8,0.7)", backdropFilter: "blur(4px)" }}
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setPreviewOpen(false)}>
                <motion.div role="dialog" aria-modal="true" aria-label={previewTitle} className="relative w-full max-w-md max-h-[90vh] overflow-y-auto p-7" style={{ background: "#efe9df" }}
                  initial={{ y: 18, scale: 0.98 }} animate={{ y: 0, scale: 1 }} exit={{ y: 12 }} transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
                  onClick={e => e.stopPropagation()}>
                  <button type="button" onClick={() => setPreviewOpen(false)} aria-label="Close preview" className="absolute top-4 right-4 p-2 transition-colors hover:text-[#8a2030]" style={{ color: MUTED_L }}><X size={18} /></button>
                  <PreviewHeading title={previewTitle} />
                  {preview}
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

function PreviewHeading({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-3 mb-6">
      <span className="relative flex w-2 h-2">
        <span className="absolute inline-flex w-full h-full rounded-full opacity-60 animate-ping" style={{ background: GOLD }} />
        <span className="relative inline-flex w-2 h-2 rounded-full" style={{ background: GOLD }} />
      </span>
      <span className="text-[10px] tracking-[0.3em] uppercase" style={{ color: FG_LIGHT, ...sans }}>{title}</span>
      <span className="text-[11px]" style={{ color: MUTED_L, ...sans }}>· updates as you type</span>
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
