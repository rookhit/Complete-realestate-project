import { useEffect, useRef, useState } from "react";
import { ChevronDown, Search, X } from "lucide-react";
import type { Prop } from "@/app/data/properties";
import { BORDER_L, FG_LIGHT, GOLD, MAROON, MUTED_L, WHITE, sans, serif } from "./brand";
import { coverStyle, frameOf } from "./cover-frame";

// Sort options for Buy/Rent. The keys double as the API's `sort` values.
export type SortKey = "newest" | "price_asc" | "price_desc";

export const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "newest",     label: "Newest first" },
  { key: "price_asc",  label: "Price: low to high" },
  { key: "price_desc", label: "Price: high to low" },
];

const LISTBOX_ID = "property-search-suggestions";

// Count, search box and sort menu above the Buy/Rent results. As you type, the box suggests
// matching properties from every listing (searchScore in data/properties.ts: titles, places and NB
// IDs, even in part); ↑ / ↓ and Enter pick one, Escape closes the list.
// API: query -> ?q= (title, location, district, type, ref like #NBS004, NBL007 or 004), sort -> ?sort=
export function ResultsToolbar({ count, query, onQuery, sort, onSort, suggestions = [], onPick }: {
  count: number;
  query: string;
  onQuery: (q: string) => void;
  sort: SortKey;
  onSort: (s: SortKey) => void;
  /** Best matches for `query`, best first (up to a handful). */
  suggestions?: Prop[];
  onPick?: (p: Prop) => void;
}) {
  const q = query.trim();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const box = useRef<HTMLDivElement>(null);
  const showList = open && q.length > 0 && !!onPick;

  // A new search starts with nothing highlighted; a click outside closes the list.
  useEffect(() => { setActive(-1); }, [q]);
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, [open]);

  const pick = (p: Prop) => { setOpen(false); onPick?.(p); };
  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showList) { if (e.key === "ArrowDown" && q) setOpen(true); return; }
    if (e.key === "ArrowDown") { e.preventDefault(); setActive(i => (suggestions.length ? (i + 1) % suggestions.length : -1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive(i => (suggestions.length ? (i - 1 + suggestions.length) % suggestions.length : -1)); }
    else if (e.key === "Enter") { const p = suggestions[active]; if (p) { e.preventDefault(); pick(p); } else setOpen(false); }
    else if (e.key === "Escape") { setOpen(false); }
  };

  return (
    <div className="flex flex-col lg:flex-row lg:items-center gap-5 mb-10 pb-6 border-b" style={{ borderColor: BORDER_L }}>
      {/* Capped and wrapping anywhere: it repeats the search, and one long word (a pasted link)
          would otherwise stretch the page sideways. */}
      <p className="text-[13px] tracking-[0.18em] uppercase shrink-0 max-w-full lg:max-w-[50%] [overflow-wrap:anywhere]" style={{ color: MUTED_L, ...sans }}>
        <span style={{ color: FG_LIGHT }}>{count}</span>{" "}
        {count === 1 ? "property" : "properties"}
        {q && <> matching &ldquo;<span style={{ color: FG_LIGHT }}>{q}</span>&rdquo;</>}
      </p>

      <div className="flex-1 flex flex-col sm:flex-row gap-3 lg:justify-end">
        <div ref={box} className="relative flex-1 sm:max-w-xs">
          <Search size={15} className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: MUTED_L }} />
          <input
            value={query}
            onChange={e => { onQuery(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
            onKeyDown={onKey}
            placeholder="Search by name, area or ref…"
            aria-label="Search properties"
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={showList}
            aria-controls={LISTBOX_ID}
            aria-activedescendant={showList && active >= 0 ? `${LISTBOX_ID}-${active}` : undefined}
            autoComplete="off"
            maxLength={100} /* the API cuts a longer q to 100 characters */
            className="w-full border pl-11 pr-10 py-3 text-[14px] outline-none transition-all focus:border-[#8a2030]"
            style={{ borderColor: BORDER_L, background: WHITE, color: FG_LIGHT, ...sans }}
          />
          {query && (
            <button onClick={() => { onQuery(""); setOpen(false); }} aria-label="Clear search"
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 transition-colors hover:text-[#8a2030]"
              style={{ color: MUTED_L }}>
              <X size={14} />
            </button>
          )}

          {showList && (
            <div className="absolute z-40 top-full mt-1.5 left-0 right-0 sm:left-auto sm:w-[26rem] max-w-[calc(100vw-2rem)] border shadow-xl"
              style={{ background: WHITE, borderColor: BORDER_L }}>
              {suggestions.length ? (
                <ul id={LISTBOX_ID} role="listbox" aria-label="Suggested properties" className="max-h-[22rem] overflow-y-auto py-1">
                  {suggestions.map((p, i) => (
                    <li key={p.id} id={`${LISTBOX_ID}-${i}`} role="option" aria-selected={i === active}
                      onMouseDown={e => e.preventDefault()} onClick={() => pick(p)} onMouseEnter={() => setActive(i)}
                      className="flex items-center gap-3 px-3 py-2.5 cursor-pointer"
                      style={{ background: i === active ? "rgba(176,136,72,0.1)" : "transparent" }}>
                      <span className="w-16 h-12 shrink-0 overflow-hidden" style={{ background: "#e9e3d8" }}>
                        {p.hero && <img src={p.hero} alt="" className="w-full h-full object-cover" style={coverStyle(frameOf(p))} />}
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className="block text-[15px] leading-snug truncate" style={{ color: FG_LIGHT, ...serif }}>{p.title}</span>
                        <span className="block text-[11px] tracking-[0.06em] truncate" style={{ color: MUTED_L, ...sans }}>
                          <span style={{ color: GOLD, fontWeight: 600 }}>#{p.nbId}</span> · {p.listing} · {p.location}
                        </span>
                      </span>
                      <span className="shrink-0 text-[12px] tabular-nums" style={{ color: MAROON, ...sans }}>{p.price}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p id={LISTBOX_ID} role="listbox" aria-label="Suggested properties" className="px-4 py-3.5 text-[13px] leading-relaxed" style={{ color: MUTED_L, ...sans }}>
                  No matches. Try an area, a property name, or a reference like NBS004.
                </p>
              )}
            </div>
          )}
        </div>

        <div className="relative shrink-0">
          <select
            value={sort}
            onChange={e => onSort(e.target.value as SortKey)}
            aria-label="Sort properties"
            className="w-full sm:w-auto border pl-4 pr-10 py-3 text-[14px] outline-none appearance-none cursor-pointer transition-all focus:border-[#8a2030]"
            style={{ borderColor: BORDER_L, background: WHITE, color: FG_LIGHT, ...sans }}>
            {SORT_OPTIONS.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
          </select>
          <ChevronDown size={15} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: MUTED_L }} />
        </div>
      </div>
    </div>
  );
}
