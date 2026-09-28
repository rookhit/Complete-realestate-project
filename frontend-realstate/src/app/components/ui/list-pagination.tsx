import { ChevronLeft, ChevronRight } from "lucide-react";
import { BORDER_L, FG_LIGHT, MUTED_L, WHITE, sans } from "./brand";

// Named list-pagination to stay clear of the unused shadcn pagination.tsx beside it.

/** Slice one page out of a list. Page numbers start at 1. */
export function paginate<T>(items: T[], page: number, perPage: number): T[] {
  return items.slice((page - 1) * perPage, page * perPage);
}

export const pageCount = (total: number, perPage: number) => Math.max(1, Math.ceil(total / perPage));

/**
 * "Showing 1–10 of 42" with previous/next and numbered pages.
 * Long ranges collapse to 1 … 4 5 6 … 12 so the control never wraps.
 */
export function ListPagination({ page, total, perPage, onPage, noun = "items" }: {
  page: number; total: number; perPage: number; onPage: (p: number) => void; noun?: string;
}) {
  const pages = pageCount(total, perPage);
  if (total === 0) return null;
  const from = (page - 1) * perPage + 1, to = Math.min(total, page * perPage);

  const nums: (number | "…")[] = [];
  for (let p = 1; p <= pages; p++) {
    if (p === 1 || p === pages || Math.abs(p - page) <= 1) nums.push(p);
    else if (nums[nums.length - 1] !== "…") nums.push("…");
  }

  const cell = "min-w-10 h-10 px-2 flex items-center justify-center border text-[13px] tabular-nums transition-colors";
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-6">
      <p className="text-[12px] tracking-[0.12em] uppercase" style={{ color: MUTED_L, ...sans }}>
        Showing <span style={{ color: FG_LIGHT }}>{from}–{to}</span> of <span style={{ color: FG_LIGHT }}>{total}</span> {noun}
      </p>
      {pages > 1 && (
        <nav aria-label="Pagination" className="flex items-center gap-1.5">
          <button type="button" aria-label="Previous page" disabled={page <= 1} onClick={() => onPage(page - 1)}
            className={`${cell} hover:border-[#8a2030] disabled:opacity-30 disabled:hover:border-[rgba(26,22,17,0.1)]`}
            style={{ borderColor: BORDER_L, color: FG_LIGHT, background: WHITE }}><ChevronLeft size={15} /></button>
          {nums.map((n, i) => n === "…"
            ? <span key={`gap${i}`} className="px-1 text-[13px]" style={{ color: MUTED_L }}>…</span>
            : <button key={n} type="button" onClick={() => onPage(n)} aria-current={n === page ? "page" : undefined}
                className={`${cell} ${n === page ? "" : "hover:border-[#8a2030]"}`}
                style={{ borderColor: n === page ? FG_LIGHT : BORDER_L, background: n === page ? FG_LIGHT : WHITE, color: n === page ? WHITE : FG_LIGHT, ...sans }}>{n}</button>)}
          <button type="button" aria-label="Next page" disabled={page >= pages} onClick={() => onPage(page + 1)}
            className={`${cell} hover:border-[#8a2030] disabled:opacity-30 disabled:hover:border-[rgba(26,22,17,0.1)]`}
            style={{ borderColor: BORDER_L, color: FG_LIGHT, background: WHITE }}><ChevronRight size={15} /></button>
        </nav>
      )}
    </div>
  );
}
