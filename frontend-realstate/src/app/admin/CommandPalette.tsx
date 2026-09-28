import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { motion, AnimatePresence } from "motion/react";
import { CornerDownLeft, Search } from "lucide-react";
import { BORDER_L, FG_LIGHT, GOLD, MUTED_L, WHITE, sans, serif } from "@/app/components/ui/brand";

export type PaletteItem = {
  id: string;
  group: "Actions" | "Properties" | "Articles" | "Team";
  label: string;
  hint?: string;          // shown faintly on the right, e.g. "NB-004" or "Lalitpur"
  keywords?: string;      // extra words to match on
  icon?: ReactNode;
  run: () => void;
};

const GROUP_ORDER: PaletteItem["group"][] = ["Actions", "Properties", "Articles", "Team"];

/**
 * Ctrl + K (⌘K on a Mac) search across everything the admin can edit. Type part of a
 * name, a reference or an action ("add video") and press Enter.
 */
export function CommandPalette({ open, onClose, items }: { open: boolean; onClose: () => void; items: PaletteItem[] }) {
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    setQ(""); setActive(0);
    const t = window.setTimeout(() => input.current?.focus(), 30);
    return () => window.clearTimeout(t);
  }, [open]);

  const results = useMemo(() => {
    const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
    // 3 = name starts with the search, 2 = name contains it, 1 = only the extra words match.
    const score = (it: PaletteItem) => {
      const label = it.label.toLowerCase();
      const text = `${label} ${it.hint ?? ""} ${it.keywords ?? ""} ${it.group}`.toLowerCase();
      if (!words.every(w => text.includes(w))) return 0;
      if (!words.length) return 1;
      if (label.startsWith(words[0])) return 3;
      return words.every(w => label.includes(w)) ? 2 : 1;
    };
    const hits = items.map(it => ({ it, s: score(it) })).filter(h => h.s > 0);
    // Groups with the best match come first ("priya" shows the person before her articles);
    // within a group, better matches first. Each group is capped so one can't flood the list.
    const best = (g: PaletteItem["group"]) => Math.max(0, ...hits.filter(h => h.it.group === g).map(h => h.s));
    const groups = [...GROUP_ORDER].sort((a, b) => best(b) - best(a) || GROUP_ORDER.indexOf(a) - GROUP_ORDER.indexOf(b));
    return groups.flatMap(g => hits.filter(h => h.it.group === g).sort((a, b) => b.s - a.s)
      .slice(0, q ? 8 : g === "Actions" ? 10 : 4).map(h => h.it));
  }, [q, items]);

  const choose = (it: PaletteItem | undefined) => { if (!it) return; onClose(); it.run(); };

  useEffect(() => {
    list.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-[85] flex items-start justify-center px-4 pt-[12vh]"
          style={{ background: "rgba(10,9,8,0.55)", backdropFilter: "blur(3px)" }}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
          <motion.div role="dialog" aria-modal="true" aria-label="Search the admin" className="w-full max-w-2xl shadow-2xl"
            style={{ background: WHITE }} onClick={e => e.stopPropagation()}
            initial={{ y: -10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -6, opacity: 0 }} transition={{ duration: 0.18 }}>
            <div className="flex items-center gap-3 px-5 border-b" style={{ borderColor: BORDER_L }}>
              <Search size={18} style={{ color: GOLD }} />
              <input ref={input} value={q} placeholder="Search properties, articles, people… or type an action"
                onChange={e => { setQ(e.target.value); setActive(0); }}
                onKeyDown={e => {
                  if (e.key === "ArrowDown") { e.preventDefault(); setActive(a => Math.min(a + 1, results.length - 1)); }
                  else if (e.key === "ArrowUp") { e.preventDefault(); setActive(a => Math.max(a - 1, 0)); }
                  else if (e.key === "Enter") { e.preventDefault(); choose(results[active]); }
                  else if (e.key === "Escape") { e.preventDefault(); onClose(); }
                }}
                className="flex-1 py-5 text-[16px] bg-transparent outline-none" style={{ color: FG_LIGHT, ...sans }} aria-label="Search" />
              <kbd className="text-[10px] tracking-[0.15em] px-2 py-1 border" style={{ borderColor: BORDER_L, color: MUTED_L, ...sans }}>ESC</kbd>
            </div>

            <div ref={list} className="max-h-[55vh] overflow-y-auto py-2" role="listbox">
              {results.length === 0 && (
                <p className="px-6 py-10 text-center text-[14px]" style={{ color: MUTED_L, ...sans }}>Nothing matches “{q}”.</p>
              )}
              {results.map((it, i) => {
                const first = i === 0 || results[i - 1].group !== it.group;
                const on = i === active;
                return (
                  <div key={it.id}>
                    {first && <p className="px-6 pt-3 pb-1.5 text-[10px] tracking-[0.28em] uppercase" style={{ color: GOLD, ...sans }}>{it.group}</p>}
                    <button type="button" data-index={i} role="option" aria-selected={on}
                      onMouseEnter={() => setActive(i)} onClick={() => choose(it)}
                      className="w-full flex items-center gap-3 px-6 py-2.5 text-left"
                      style={{ background: on ? "rgba(176,136,72,0.1)" : "transparent" }}>
                      <span className="w-5 flex justify-center shrink-0" style={{ color: on ? GOLD : MUTED_L }}>{it.icon}</span>
                      <span className="flex-1 min-w-0 truncate text-[14px]" style={{ color: FG_LIGHT, ...(it.group === "Actions" ? sans : serif) }}>{it.label}</span>
                      {it.hint && <span className="shrink-0 text-[12px]" style={{ color: MUTED_L, ...sans }}>{it.hint}</span>}
                      {on && <CornerDownLeft size={13} className="shrink-0" style={{ color: GOLD }} />}
                    </button>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center gap-5 px-6 py-3 border-t text-[11px]" style={{ borderColor: BORDER_L, color: MUTED_L, ...sans }}>
              <span><b style={{ color: FG_LIGHT }}>↑ ↓</b> to move</span>
              <span><b style={{ color: FG_LIGHT }}>Enter</b> to open</span>
              <span className="ml-auto">Open this any time with <b style={{ color: FG_LIGHT }}>Ctrl K</b></span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
