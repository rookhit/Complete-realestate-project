import { useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { AlertTriangle } from "lucide-react";
import { BORDER_L, FG_LIGHT, MAROON, MUTED_L, WHITE, sans, serif } from "./brand";
import { Button } from "./form-controls";

/**
 * "Are you sure?" before anything that cannot be undone, such as deleting a
 * property or a review. Escape or clicking outside cancels.
 */
export function ConfirmDialog({ open, title, message, confirmLabel = "Delete", onConfirm, onCancel }: {
  open: boolean; title: string; message: string; confirmLabel?: string;
  onConfirm: () => void; onCancel: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onCancel(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-[80] flex items-center justify-center p-5"
          style={{ background: "rgba(10,9,8,0.62)", backdropFilter: "blur(4px)" }}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onCancel}>
          <motion.div role="alertdialog" aria-modal="true" aria-label={title}
            className="w-full max-w-md border p-8" style={{ background: WHITE, borderColor: BORDER_L }}
            initial={{ opacity: 0, y: 16, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }} onClick={e => e.stopPropagation()}>
            <div className="w-11 h-11 rounded-full flex items-center justify-center mb-5" style={{ background: "rgba(138,32,48,0.08)", color: MAROON }}>
              <AlertTriangle size={19} />
            </div>
            <h3 className="text-2xl mb-2" style={{ color: FG_LIGHT, ...serif }}>{title}</h3>
            <p className="text-[15px] leading-relaxed mb-8" style={{ color: MUTED_L, ...sans }}>{message}</p>
            <div className="flex flex-col-reverse sm:flex-row gap-3 sm:justify-end">
              <Button variant="quiet" onClick={onCancel}>Cancel</Button>
              <Button onClick={onConfirm}>{confirmLabel}</Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
