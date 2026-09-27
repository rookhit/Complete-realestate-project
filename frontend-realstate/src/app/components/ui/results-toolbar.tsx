import { ChevronDown, Search, X } from "lucide-react";
import { BORDER_L, FG_LIGHT, MUTED_L, WHITE, sans } from "./brand";

/**
 * Sort orders for the Buy/Rent results. The keys are the values the listings
 * API should accept in its `sort` query parameter.
 */
export type SortKey = "newest" | "price_asc" | "price_desc";

export const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "newest",     label: "Newest first" },
  { key: "price_asc",  label: "Price: low to high" },
  { key: "price_desc", label: "Price: high to low" },
];

/**
 * Result count, free-text search and sort, shown above the Buy/Rent results.
 *
 * For the backend: `query` maps to the listings API's `q` parameter (matched
 * against title, location, district, type and property ref like "NB-004"),
 * and `sort` to its `sort` parameter.
 */
export function ResultsToolbar({ count, query, onQuery, sort, onSort }: {
  count: number;
  query: string;
  onQuery: (q: string) => void;
  sort: SortKey;
  onSort: (s: SortKey) => void;
}) {
  const q = query.trim();
  return (
    <div className="flex flex-col lg:flex-row lg:items-center gap-5 mb-10 pb-6 border-b" style={{ borderColor: BORDER_L }}>
      <p className="text-[13px] tracking-[0.18em] uppercase shrink-0" style={{ color: MUTED_L, ...sans }}>
        <span style={{ color: FG_LIGHT }}>{count}</span>{" "}
        {count === 1 ? "property" : "properties"}
        {q && <> matching &ldquo;<span style={{ color: FG_LIGHT }}>{q}</span>&rdquo;</>}
      </p>

      <div className="flex-1 flex flex-col sm:flex-row gap-3 lg:justify-end">
        <div className="relative flex-1 sm:max-w-xs">
          <Search size={15} className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: MUTED_L }} />
          <input
            value={query}
            onChange={e => onQuery(e.target.value)}
            placeholder="Search by name, area or ref…"
            aria-label="Search properties"
            className="w-full border pl-11 pr-10 py-3 text-[14px] outline-none transition-all focus:border-[#8a2030]"
            style={{ borderColor: BORDER_L, background: WHITE, color: FG_LIGHT, ...sans }}
          />
          {query && (
            <button onClick={() => onQuery("")} aria-label="Clear search"
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 transition-colors hover:text-[#8a2030]"
              style={{ color: MUTED_L }}>
              <X size={14} />
            </button>
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
