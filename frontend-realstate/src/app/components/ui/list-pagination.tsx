import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { BORDER_L, FG_LIGHT, MUTED_L, WHITE, sans } from "./brand";

// Named list-pagination to stay clear of the unused shadcn pagination.tsx beside it.

/** Slice one page out of a list. Page numbers start at 1. */
export function paginate<T>(items: T[], page: number, perPage: number): T[] {
  return items.slice((page - 1) * perPage, page * perPage);
}

export const pageCount = (total: number, perPage: number) => Math.max(1, Math.ceil(total / perPage));

// ─── Phones: lists grow with "See more" instead of turning pages ────────────────
// On a phone a page of results is a long column, and page numbers at its foot send the reader back to
// the top of the next page. Phones (under 768 px, the same cut-off as the `md:` classes, so a phone held
// sideways counts too) show a short batch and a "See more" button that adds
// the next batch below. "Page n" then means "the first n batches", so the page number in the address
// (Buy / Rent ?p=) and Back still bring the reader to the same place.

const PHONE = "(max-width: 767px)";
const subscribePhone = (on: () => void) => { const m = window.matchMedia(PHONE); m.addEventListener("change", on); return () => m.removeEventListener("change", on); };

/** True on phone-width screens (under 768 px); follows rotation and resizing. */
export function usePhone(): boolean {
  return useSyncExternalStore(subscribePhone, () => window.matchMedia(PHONE).matches, () => false);
}

/**
 * Keeps the reader among the same items when the screen switches between phone and larger (rotating
 * a phone, resizing a window): a phone's page n is the first n batches of `phonePer`, elsewhere page n
 * of `perPage`. To a phone: every batch through the end of that page. From a phone: the page holding
 * the first item of the last batch shown.
 */
export function useSamePageAcrossSizes(phone: boolean, page: number, setPage: (n: number) => void, phonePer: number, perPage: number): void {
  const was = useRef(phone);
  useEffect(() => {
    if (was.current === phone) return;
    was.current = phone;
    setPage(phone ? Math.ceil((page * perPage) / phonePer) : Math.floor(((page - 1) * phonePer) / perPage) + 1);
  }, [phone]);   // only when the screen kind changes
}

/** What "page `page`" shows: that page on larger screens; on a phone, every batch up to it. */
export function pageItems<T>(items: T[], page: number, perPage: number, phone: boolean): T[] {
  return phone ? items.slice(0, page * perPage) : paginate(items, page, perPage);
}

/** "Showing 6 of 20 properties" and a "See more" button while there is more. */
export function SeeMore({ shown, total, onMore, noun = "items", dark = false }: {
  shown: number; total: number; onMore: () => void; noun?: string; dark?: boolean;
}) {
  if (total === 0) return null;
  const color = dark ? "rgba(240,235,224,0.85)" : FG_LIGHT;
  return (
    <div className="flex flex-col items-center gap-3 pt-6">
      <p className="text-[12px] tracking-[0.12em] uppercase" style={{ color: dark ? "rgba(240,235,224,0.5)" : MUTED_L, ...sans }}>
        Showing <span style={{ color }}>{Math.min(shown, total)}</span> of <span style={{ color }}>{total}</span> {noun}
      </p>
      {shown < total && (
        <button type="button" onClick={onMore}
          className="w-full max-w-xs inline-flex items-center justify-center gap-2 h-12 border text-[11px] tracking-[0.24em] uppercase transition-colors"
          style={{ borderColor: dark ? "rgba(240,235,224,0.25)" : BORDER_L, background: dark ? "transparent" : WHITE, color, ...sans }}>
          See more<ChevronDown size={15} />
        </button>
      )}
    </div>
  );
}

/**
 * Page turning for a list whose pager sits below it: `turn(n)` shows page n and, if the list's top
 * has scrolled out of view, brings it back (put `listTop` on the list, with a scroll-margin-top for
 * the fixed menu bar), so the reader starts the new page at its first item, not its last.
 */
export function usePageTurner(setPage: (n: number) => void) {
  const listTop = useRef<HTMLDivElement>(null);
  const turn = useCallback((n: number) => {
    setPage(n);
    const el = listTop.current;
    if (!el) return;
    const top = el.getBoundingClientRect().top;
    if (top >= 0 && top < window.innerHeight * 0.5) return;   // already in view: don't move the page
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ behavior: still ? "auto" : "smooth", block: "start" });
  }, [setPage]);
  return { listTop, turn };
}

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
